import { AdapterInstance } from "@iobroker/adapter-core";
import { ActionContext } from "./ActionContext";
import { ProgressDialog } from "./ProgressDialog";
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
				const action = msg.message as { actionId: string; };
				const context = new MessageContext<boolean>(msg, this.adapter);
				this.contexts.set(msg._id, context);
				const result = await this.handleInstanceAction(action.actionId, context);
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
					this.log.warn(`Unknown message origin: ${origin}`)
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
	private hasOpenProgressDialog = false;
	private lastMessage?: ioBroker.Message;
	private progressHandler?: (message: Record<string, any>) => void;

	constructor(msg: ioBroker.Message, private readonly adapter: AdapterInstance) {
		this.lastMessage = msg;
	}

	showMessage(text: ioBroker.StringOrTranslated): Promise<void> {
		this.checkPreconditions();
		const promise = new Promise<void>((resolve) => {
			this.progressHandler = () => resolve();
		});
		this.send("message", {
			message: text,
		});
		return promise;
	}

	showConfirmation(text: ioBroker.StringOrTranslated): Promise<boolean> {
		this.checkPreconditions();
		const promise = new Promise<boolean>((resolve) => {
			this.progressHandler = (msg) => resolve(!!msg.confirm);
		});
		this.send("confirm", {
			confirm: text,
		});
		return promise;
	}

	showForm(schema: JsonFormSchema, options?: {data?: JsonFormData; title?:string;}): Promise<JsonFormData | undefined> {
		this.checkPreconditions();
		const promise = new Promise<JsonFormData | undefined>((resolve) => {
			this.progressHandler = (msg) => resolve(msg.data);
		});
		this.send("form", {
			form: { schema, ...options },
		});
		return promise;
	}

	openProgress(title: string, options?: {indeterminate?: boolean, value?: number, label?: string}): Promise<ProgressDialog> {
		this.checkPreconditions();
		this.hasOpenProgressDialog = true;
		const dialog: ProgressDialog ={
			update: (update: {
				title?: string;
				indeterminate?: boolean;
				value?:number;
				label?: string;
			}) => {
				const promise = new Promise<void>((resolve) => {
					this.progressHandler = () => resolve();
				});
				this.send("progress", {
					progress: { title, ...options, ...update, open: true },
				});
				return promise;
			},

			close: () => {
				const promise = new Promise<void>((resolve) => {
					this.progressHandler = () => {
						this.hasOpenProgressDialog = false;
						resolve();
					}
				});
				this.send("progress", {
					progress: { open: false },
				});
				return promise;
			}
		};

		const promise = new Promise<ProgressDialog>((resolve) => {
			this.progressHandler = (msg) => resolve(dialog);
		});
		this.send("progress", {
			progress: { title, ...options, open: true },
		});
		return promise;
	}

	sendFinalResult(result: { refresh: T }): void {
		this.send("result", {
			result,
		});
	}

	handleProgress(message: ioBroker.Message): void {
		const currentHandler = this.progressHandler;
		if (currentHandler && typeof message.message !== "string") {
			this.lastMessage = message;
			this.progressHandler = undefined;
			currentHandler(message.message);
		}
	}

	private checkPreconditions() {
		if (this.hasOpenProgressDialog) {
			throw new Error("Can't show another dialog while a progress dialog is open. Please call 'close()' on the dialog before opening another dialog.");
		}
	}

	private send(type: string, message: any): void {
		if (!this.lastMessage) {
			throw new Error("No outstanding message, can't send a new one")
		}
		this.adapter.sendTo(
			this.lastMessage.from,
			this.lastMessage.command,
			{
				...message,
				type,
				origin: (this.lastMessage.message as any).origin || this.lastMessage._id,
			},
			this.lastMessage.callback,
		);
		this.lastMessage = undefined;
	}
}
