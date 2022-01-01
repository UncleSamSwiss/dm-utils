import { AdapterInstance } from "@iobroker/adapter-core";
import { ActionContext } from "./ActionContext";
import { DeviceDetails, DeviceInfo, DeviceRefresh, InstanceDetails, JsonFormData, JsonFormSchema, RetVal } from "./types";

export abstract class DeviceManagement<T extends AdapterInstance = AdapterInstance> {
	private instanceInfo?: InstanceDetails;
	private devices?: DeviceInfo[];

	private readonly contexts = new Map<number, MessageContext<any>>();

	constructor(protected readonly adapter: T) {
		adapter.on("message", this.onMessage.bind(this));
	}

	protected get log(): ioBroker.Logger {
		return this.adapter.log;
	}

	protected getInstanceInfo(): RetVal<InstanceDetails> {
		return { apiVersion: "v1" };
	}

	protected abstract listDevices(): RetVal<DeviceInfo[]>;

	protected getDeviceDetails(id: string): RetVal<DeviceDetails> {
		return { id, schema: {} };
	}

	protected handleInstanceAction(_actionId: string, _context: ActionContext): RetVal<{ refresh: boolean }> {
		return { refresh: false };
	}

	protected handleDeviceAction(
		_deviceId: string,
		_actionId: string,
		_context: ActionContext,
	): RetVal<{ refresh: DeviceRefresh }> {
		return { refresh: false };
	}

	private onMessage(obj: ioBroker.Message): void {
		if (!obj.command.startsWith("dm:")) {
			return;
		}
		this.handleMessage(obj).catch(this.log.error);
	}

	private async handleMessage(msg: ioBroker.Message): Promise<void> {
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
				const details = await this.getDeviceDetails(msg.message as string);
				this.adapter.sendTo(msg.from, msg.command, details, msg.callback);
				return;
			case "dm:instanceAction": {
				const actionId = msg.message as string;
				const context = new MessageContext<boolean>(msg, this.adapter);
				this.contexts.set(msg._id, context);
				const result = await this.handleInstanceAction(actionId, context);
				this.contexts.delete(msg._id);
				context.sendFinalResult(result);
				return;
			}
			case "dm:deviceAction": {
				const action = msg.message as { actionId: string; deviceId: string };
				const context = new MessageContext<DeviceRefresh>(msg, this.adapter);
				this.contexts.set(msg._id, context);
				const result = await this.handleDeviceAction(action.deviceId, action.actionId, context);
				this.contexts.delete(msg._id);
				context.sendFinalResult(result);
				return;
			}
			case "dm:actionProgress": {
				const { origin } = msg.message as { origin: number };
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

class MessageContext<T> implements ActionContext {
	private lastMessage: ioBroker.Message;
	private progressHandler?: (message: Record<string, any>) => void;

	constructor(msg: ioBroker.Message, private readonly adapter: AdapterInstance) {
		this.lastMessage = msg;
	}

	showMessage(text: ioBroker.StringOrTranslated): Promise<void> {
		const promise = new Promise<void>((resolve) => {
			this.progressHandler = () => resolve();
		});
		this.send("message", {
			message: text,
		});
		return promise;
	}

	showConfirmation(text: ioBroker.StringOrTranslated): Promise<boolean> {
		const promise = new Promise<boolean>((resolve) => {
			this.progressHandler = (msg) => resolve(!!msg.confirm);
		});
		this.send("confirm", {
			confirm: text,
		});
		return promise;
	}

	showForm(schema: JsonFormSchema, data?: JsonFormData): Promise<JsonFormData | undefined> {
		const promise = new Promise<JsonFormData | undefined>((resolve) => {
			this.progressHandler = (msg) => resolve(msg.data);
		});
		this.send("form", {
			form: { schema, data },
		});
		return promise;
	}

	sendFinalResult(result: { refresh: T }): void {
		this.send("result", {
			result,
		});
	}

	handleProgress(message: ioBroker.Message): void {
		if (this.progressHandler && typeof message.message !== "string") {
			this.lastMessage = message;
			this.progressHandler(message.message);
			this.progressHandler = undefined;
		}
	}

	private send(type: string, message: any): void {
		this.adapter.sendTo(
			this.lastMessage.from,
			this.lastMessage.command,
			{
				...message,
				type,
				origin: this.lastMessage._id,
			},
			this.lastMessage.callback,
		);
	}
}
