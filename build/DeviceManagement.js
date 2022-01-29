"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceManagement = void 0;
class DeviceManagement {
    constructor(adapter) {
        this.adapter = adapter;
        this.contexts = new Map();
        adapter.on("message", this.onMessage.bind(this));
    }
    get log() {
        return this.adapter.log;
    }
    getInstanceInfo() {
        return { apiVersion: "v1" };
    }
    getDeviceDetails(id) {
        return { id, schema: {} };
    }
    handleInstanceAction(_actionId, _context) {
        return { refresh: false };
    }
    handleDeviceAction(_deviceId, _actionId, _context) {
        return { refresh: false };
    }
    onMessage(obj) {
        if (!obj.command.startsWith("dm:")) {
            return;
        }
        this.handleMessage(obj).catch(this.log.error);
    }
    async handleMessage(msg) {
        this.log.debug("DeviceManagement received: " + JSON.stringify(msg));
        switch (msg.command) {
            case "dm:instanceInfo":
                this.instanceInfo = await this.getInstanceInfo();
                this.adapter.sendTo(msg.from, msg.command, this.instanceInfo, msg.callback);
                return;
            case "dm:listDevices":
                this.devices = await this.listDevices();
                this.adapter.sendTo(msg.from, msg.command, this.devices, msg.callback);
                return;
            case "dm:deviceDetails":
                const details = await this.getDeviceDetails(msg.message);
                this.adapter.sendTo(msg.from, msg.command, details, msg.callback);
                return;
            case "dm:instanceAction": {
                const action = msg.message;
                const context = new MessageContext(msg, this.adapter);
                this.contexts.set(msg._id, context);
                const result = await this.handleInstanceAction(action.actionId, context);
                this.contexts.delete(msg._id);
                context.sendFinalResult(result);
                return;
            }
            case "dm:deviceAction": {
                const action = msg.message;
                const context = new MessageContext(msg, this.adapter);
                this.contexts.set(msg._id, context);
                const result = await this.handleDeviceAction(action.deviceId, action.actionId, context);
                this.contexts.delete(msg._id);
                context.sendFinalResult(result);
                return;
            }
            case "dm:actionProgress": {
                const { origin } = msg.message;
                const context = this.contexts.get(origin);
                if (!context) {
                    this.log.warn(`Unknown message origin: ${origin}`);
                    this.adapter.sendTo(msg.from, msg.command, { error: "Unknown action origin" }, msg.callback);
                    return;
                }
                context.handleProgress(msg);
                return;
            }
        }
    }
}
exports.DeviceManagement = DeviceManagement;
class MessageContext {
    constructor(msg, adapter) {
        this.adapter = adapter;
        this.hasOpenProgressDialog = false;
        this.lastMessage = msg;
    }
    showMessage(text) {
        this.checkPreconditions();
        const promise = new Promise((resolve) => {
            this.progressHandler = () => resolve();
        });
        this.send("message", {
            message: text,
        });
        return promise;
    }
    showConfirmation(text) {
        this.checkPreconditions();
        const promise = new Promise((resolve) => {
            this.progressHandler = (msg) => resolve(!!msg.confirm);
        });
        this.send("confirm", {
            confirm: text,
        });
        return promise;
    }
    showForm(schema, options) {
        this.checkPreconditions();
        const promise = new Promise((resolve) => {
            this.progressHandler = (msg) => resolve(msg.data);
        });
        this.send("form", {
            form: Object.assign({ schema }, options),
        });
        return promise;
    }
    openProgress(title, options) {
        this.checkPreconditions();
        this.hasOpenProgressDialog = true;
        const dialog = {
            update: (update) => {
                const promise = new Promise((resolve) => {
                    this.progressHandler = () => resolve();
                });
                this.send("progress", {
                    progress: Object.assign(Object.assign(Object.assign({ title }, options), update), { open: true }),
                });
                return promise;
            },
            close: () => {
                const promise = new Promise((resolve) => {
                    this.progressHandler = () => {
                        this.hasOpenProgressDialog = false;
                        resolve();
                    };
                });
                this.send("progress", {
                    progress: { open: false },
                });
                return promise;
            }
        };
        const promise = new Promise((resolve) => {
            this.progressHandler = (msg) => resolve(dialog);
        });
        this.send("progress", {
            progress: Object.assign(Object.assign({ title }, options), { open: true }),
        });
        return promise;
    }
    sendFinalResult(result) {
        this.send("result", {
            result,
        });
    }
    handleProgress(message) {
        const currentHandler = this.progressHandler;
        if (currentHandler && typeof message.message !== "string") {
            this.lastMessage = message;
            this.progressHandler = undefined;
            currentHandler(message.message);
        }
    }
    checkPreconditions() {
        if (this.hasOpenProgressDialog) {
            throw new Error("Can't show another dialog while a progress dialog is open. Please call 'close()' on the dialog before opening another dialog.");
        }
    }
    send(type, message) {
        if (!this.lastMessage) {
            throw new Error("No outstanding message, can't send a new one");
        }
        this.adapter.sendTo(this.lastMessage.from, this.lastMessage.command, Object.assign(Object.assign({}, message), { type, origin: this.lastMessage.message.origin || this.lastMessage._id }), this.lastMessage.callback);
        this.lastMessage = undefined;
    }
}
