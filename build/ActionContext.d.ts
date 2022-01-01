/// <reference types="iobroker" />
import { JsonFormSchema, JsonFormData } from ".";
export interface ActionContext {
    showMessage(text: ioBroker.StringOrTranslated): Promise<void>;
    showConfirmation(text: ioBroker.StringOrTranslated): Promise<boolean>;
    showForm(schema: JsonFormSchema, data?: JsonFormData): Promise<JsonFormData | undefined>;
}
