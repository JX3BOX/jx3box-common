function createStorage(initial) {
    const values = new Map(Object.entries(initial || {}));
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        },
        dump() {
            return Object.fromEntries(values.entries());
        },
    };
}

function createElement(options) {
    const settings = options || {};
    const attributes = new Map();
    return {
        nodeType: 1,
        tagName: settings.tagName || "DIV",
        parentElement: settings.parentElement || null,
        isContentEditable: !!settings.isContentEditable,
        setAttribute(name, value) {
            attributes.set(name, String(value));
        },
        getAttribute(name) {
            return attributes.has(name) ? attributes.get(name) : null;
        },
        hasAttribute(name) {
            return attributes.has(name);
        },
        removeAttribute(name) {
            attributes.delete(name);
        },
        getBoundingClientRect() {
            return settings.rect || { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 };
        },
    };
}

function createRuntime() {
    const documentListeners = {};
    const windowListeners = {};
    const localStorage = createStorage();
    const sessionStorage = createStorage();
    const documentElement = {
        clientWidth: 1000,
        clientHeight: 800,
        scrollWidth: 1000,
        scrollHeight: 2000,
    };
    const body = { scrollWidth: 1000, scrollHeight: 2000 };
    let randomCall = 0;
    const runtime = {
        localStorage,
        sessionStorage,
        location: { hostname: "www.jx3box.com", pathname: "/index/", href: "https://www.jx3box.com/index/" },
        innerWidth: 1000,
        innerHeight: 800,
        scrollX: 0,
        scrollY: 0,
        crypto: {
            getRandomValues(bytes) {
                randomCall += 1;
                for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 17 + 11 + randomCall) % 256;
                return bytes;
            },
        },
        navigator: {},
        document: {
            referrer: "https://ref.example/path?secret=1",
            visibilityState: "visible",
            documentElement,
            body,
            addEventListener(name, handler) {
                documentListeners[name] = handler;
            },
            removeEventListener(name, handler) {
                if (documentListeners[name] === handler) delete documentListeners[name];
            },
        },
        addEventListener(name, handler) {
            windowListeners[name] = handler;
        },
        removeEventListener(name, handler) {
            if (windowListeners[name] === handler) delete windowListeners[name];
        },
        setTimeout,
        clearTimeout,
        __documentListeners: documentListeners,
        __windowListeners: windowListeners,
    };
    return runtime;
}

function okResponse(payload) {
    return {
        ok: true,
        status: 200,
        async json() {
            return payload || {};
        },
    };
}

module.exports = { createElement, createRuntime, createStorage, okResponse };
