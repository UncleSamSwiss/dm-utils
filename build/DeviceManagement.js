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
                const actionId = msg.message;
                const context = new MessageContext(msg, this.adapter);
                this.contexts.set(msg._id, context);
                const result = await this.handleInstanceAction(actionId, context);
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
        this.lastMessage = msg;
    }
    showMessage(text) {
        const promise = new Promise((resolve) => {
            this.progressHandler = () => resolve();
        });
        this.send("message", {
            message: text,
        });
        return promise;
    }
    showConfirmation(text) {
        const promise = new Promise((resolve) => {
            this.progressHandler = (msg) => resolve(!!msg.confirm);
        });
        this.send("confirm", {
            confirm: text,
        });
        return promise;
    }
    showForm(schema, data) {
        const promise = new Promise((resolve) => {
            this.progressHandler = (msg) => resolve(msg.data);
        });
        this.send("form", {
            form: { schema, data },
        });
        return promise;
    }
    sendFinalResult(result) {
        this.send("result", {
            result,
        });
    }
    handleProgress(message) {
        if (this.progressHandler && typeof message.message !== "string") {
            this.lastMessage = message;
            this.progressHandler(message.message);
            this.progressHandler = undefined;
        }
    }
    send(type, message) {
        this.adapter.sendTo(this.lastMessage.from, this.lastMessage.command, Object.assign(Object.assign({}, message), { type, origin: this.lastMessage._id }), this.lastMessage.callback);
    }
}
