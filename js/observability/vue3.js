import { getTelemetryEventId } from "./dedupe.js";

function captureVueError(observer, error) {
    if (!observer || typeof observer.captureError !== "function" || getTelemetryEventId(error)) return;
    try {
        const result = observer.captureError(error, { source: "vue", severity: "error" });
        if (result && typeof result.catch === "function") result.catch(function () {});
    } catch (captureError) {
        // Telemetry must never replace Vue's configured error handling.
    }
}

function createVue3ErrorObserverPlugin(observer) {
    const installations = new Map();

    function install(app) {
        if (!app || !app.config || installations.has(app)) {
            const current = installations.get(app);
            return current ? current.dispose : function () {};
        }

        const previous = app.config.errorHandler;
        function errorHandler(error) {
            captureVueError(observer, error);
            if (typeof previous === "function") return previous.apply(this, arguments);
            return undefined;
        }

        let disposed = false;
        let unregisterObserverDisposer = null;
        function dispose() {
            if (disposed) return;
            disposed = true;
            if (app.config.errorHandler === errorHandler) app.config.errorHandler = previous;
            installations.delete(app);
            if (typeof unregisterObserverDisposer === "function") {
                const unregister = unregisterObserverDisposer;
                unregisterObserverDisposer = null;
                try {
                    unregister();
                } catch (error) {
                    // Disposer registration is best-effort.
                }
            }
        }

        app.config.errorHandler = errorHandler;
        installations.set(app, { dispose });

        if (observer && typeof observer.registerDisposer === "function") {
            try {
                unregisterObserverDisposer = observer.registerDisposer(dispose);
            } catch (error) {
                unregisterObserverDisposer = null;
            }
        }
        return dispose;
    }

    function uninstall(app) {
        if (app) {
            const installation = installations.get(app);
            if (installation) installation.dispose();
            return;
        }
        Array.from(installations.values()).forEach(function (installation) {
            installation.dispose();
        });
    }

    return {
        install,
        uninstall,
        destroy: uninstall,
    };
}

export { createVue3ErrorObserverPlugin };
