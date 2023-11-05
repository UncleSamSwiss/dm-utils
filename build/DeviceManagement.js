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
    handleInstanceAction(actionId, context) {
        var _a;
        if (!this.instanceInfo) {
            this.log.warn(`Instance action ${actionId} was called before getInstanceInfo()`);
            return { error: { code: 101, message: `Instance action ${actionId} was called before getInstanceInfo()` } };
        }
        const action = (_a = this.instanceInfo.actions) === null || _a === void 0 ? void 0 : _a.find((a) => a.id === actionId);
        if (!action) {
            this.log.warn(`Instance action ${actionId} is unknown`);
            return { error: { code: 102, message: `Instance action ${actionId} is unknown` } };
        }
        if (!action.handler) {
            this.log.warn(`Instance action ${actionId} is disabled because it has no handler`);
            return { error: { code: 103, message: `Instance action ${actionId} is disabled because it has no handler` } };
        }
        return action.handler(context);
    }
    handleDeviceAction(deviceId, actionId, context) {
        var _a;
        if (!this.devices) {
            this.log.warn(`Device action ${actionId} was called before listDevices()`);
            return { refresh: false };
        }
        const device = this.devices.get(deviceId);
        if (!device) {
            this.log.warn(`Device action ${actionId} was called on unknown device: ${deviceId}`);
            return { refresh: false };
        }
        const action = (_a = device.actions) === null || _a === void 0 ? void 0 : _a.find((a) => a.id === actionId);
        if (!action) {
            this.log.warn(`Device action ${actionId} doesn't exist on device ${deviceId}`);
            return { refresh: false };
        }
        if (!action.handler) {
            this.log.warn(`Device action ${actionId} on ${deviceId} is disabled because it has no handler`);
            return { refresh: false };
        }
        return action.handler(deviceId, context);
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
                this.sendReply(Object.assign(Object.assign({}, this.instanceInfo), { actions: this.convertActions(this.instanceInfo.actions) }), msg);
                return;
            case "dm:listDevices":
                const deviceList = await this.listDevices();
                this.devices = deviceList.reduce((map, value) => {
                    if (map.has(value.id)) {
                        throw new Error(`Device ID ${value.id} is not unique`);
                    }
                    map.set(value.id, value);
                    return map;
                }, new Map());
                this.sendReply(deviceList.map((d) => (Object.assign(Object.assign({}, d), { actions: this.convertActions(d.actions) }))), msg);
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
                    this.sendReply({ error: "Unknown action origin" }, msg);
                    return;
                }
                context.handleProgress(msg);
                return;
            }
        }
    }
    convertActions(actions) {
        if (!actions)
            return undefined;
        const ids = new Set();
        actions.forEach((a) => {
            if (ids.has(a.id)) {
                throw new Error(`Action ID ${a.id} is used twice, this would lead to unexpected behavior`);
            }
            ids.add(a.id);
        });
        return actions.map((a) => (Object.assign(Object.assign({}, a), { handler: undefined, disabled: !a.handler })));
    }
    sendReply(reply, msg) {
        this.adapter.sendTo(msg.from, msg.command, reply, msg.callback);
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
            },
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
