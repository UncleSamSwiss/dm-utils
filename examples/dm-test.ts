import { ActionContext, DeviceDetails, DeviceInfo, DeviceManagement, DeviceRefresh } from "../src";

const demoFormSchema = {
	type: "tabs",
	items: {
		options1: {
			type: "panel",
			label: "Tab1",
			icon: "base64 svg", // optional
			items: {
				myPort: {
					type: "number",
					min: 1,
					max: 65565,
					label: "Number",
					sm: 6, // 1 - 12
					// "validator": "'"!!data.name"'", // else error
					hidden: "data.myType === 1", // hidden if myType is 1
					disabled: "data.myType === 2", // disabled if myType is 2
				},
				myType: {
					// name could support more than one levelhelperText
					newLine: true, // must start from new row
					type: "select",
					label: "My Type",
					sm: 6, // 1 - 12
					options: [
						{ label: "option 0", value: 0 },
						{ label: "option 1", value: 1 },
						{ label: "option 2", value: 2 },
					],
				},
				myBool: {
					type: "checkbox",
					label: "My checkbox",
				},
			},
		},
		options2: {
			type: "panel",
			label: "Tab2",
			icon: "base64 svg", // optional
			items: {
				secondPort: {
					type: "number",
					min: 1,
					max: 65565,
					label: "Second Number",
					sm: 6, // 1 - 12
					// "validator": "'"!!data.name"'", // else error
					hidden: "data.secondType === 1", // hidden if myType is 1
					disabled: "data.secondType === 2", // disabled if myType is 2
				},
				secondType: {
					// name could support more than one levelhelperText
					newLine: true, // must start from new row
					type: "select",
					label: "Second Type",
					sm: 6, // 1 - 12
					options: [
						{ label: "option 0", value: 0 },
						{ label: "option 1", value: 1 },
						{ label: "option 2", value: 2 },
					],
				},
				secondBool: {
					type: "checkbox",
					label: "Second checkbox",
				},
			},
		},
	},
};

class DmTestDeviceManagement extends DeviceManagement {
	protected async listDevices(): Promise<DeviceInfo[]> {
		return [
			{ id: "test-123", name: "Test 123", status: "connected" },
			{ id: "test-345", name: "Test 345", status: "disconnected", hasDetails: true, actions: [] },
			{
				id: "test-789",
				name: "Test 789",
				status: "connected",
				actions: [
					{
						id: "play",
						icon: "fas fa-play",
					},
					{
						id: "pause",
						icon: "fa-pause",
						description: "Pause device",
					},
					{
						id: "forward",
						icon: "forward",
						description: "Forward",
						disabled: true,
					},
				],
			},
			{
				id: "test-ABC",
				name: "Test ABC",
				status: "connected",
				actions: [
					{
						id: "forms",
						icon: "fab fa-wpforms",
						description: "Show forms flow",
					},
				],
			},
		];
	}

	protected override async handleDeviceAction(
		deviceId: string,
		actionId: string,
		context: ActionContext,
	): Promise<{ refresh: DeviceRefresh }> {
		switch (actionId) {
			case "play":
				this.log.info(`Play was pressed on ${deviceId}`);
				return { refresh: false };
			case "pause":
				this.log.info(`Pause was pressed on ${deviceId}`);
				const confirm = await context.showConfirmation("Do you want to refresh the device only?");
				return { refresh: confirm ? "device" : "instance" };
			case "forms":
				this.log.info(`Forms was pressed on ${deviceId}`);
				const data = await context.showForm(demoFormSchema, { data: { myPort: 8081, secondPort: 8082 } });
				if (!data) {
					await context.showMessage("You cancelled the previous form!");
				} else {
					await context.showMessage(`You entered: ${JSON.stringify(data)}`);
				}
				return { refresh: false };
			default:
				throw new Error(`Unknown action ${actionId}`);
		}
	}

	protected override async getDeviceDetails(id: string): Promise<DeviceDetails> {
		const schema = {
			type: "panel",
			items: {
				text1: {
					type: "staticText",
					text: "This is some description",
					sm: 12,
				},
				button1: {
					type: "sendTo",
					label: "Click me to send a message!",
					sm: 6,
					command: "send",
					data: { hello: "world" },
				},
			},
		};
		return { id, schema };
	}
}
