const localforage = require("localforage");
class IDB {
    // 初始化数据库
    constructor(dbName, storeName) {
        if (!window.indexedDB) {
            console.log("不支持IndexedDB");
            return;
        }

        this.dbName = dbName || "jx3box";
        this.storeName = storeName || "posts";
        console.log("%c[IDB] Use Database - ", "color:#ff3399;", `${this.dbName} > ${this.storeName}`);
        this.db = localforage.createInstance({
            name: this.dbName,
            storeName: this.storeName,
            driver: localforage.INDEXEDDB,
        });
        return this.db;
    }
}

export default IDB;

// const DB = new IDB();
// DB.ready().then(() => {
//     DB.setItem('key','val')
// })
