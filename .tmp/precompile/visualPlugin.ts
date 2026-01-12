import { Visual } from "../../src/visual";
import powerbiVisualsApi from "powerbi-visuals-api";
import IVisualPlugin = powerbiVisualsApi.visuals.plugins.IVisualPlugin;
import VisualConstructorOptions = powerbiVisualsApi.extensibility.visual.VisualConstructorOptions;
import DialogConstructorOptions = powerbiVisualsApi.extensibility.visual.DialogConstructorOptions;
var powerbiKey: any = "powerbi";
var powerbi: any = window[powerbiKey];
var SynopticPanelE2B5B9B6B0B14B8C8B0E6C0A7D6A1F01: IVisualPlugin = {
    name: 'SynopticPanelE2B5B9B6B0B14B8C8B0E6C0A7D6A1F01',
    displayName: 'Synoptic Panel',
    class: 'Visual',
    apiVersion: '5.3.0',
    create: (options?: VisualConstructorOptions) => {
        if (Visual) {
            return new Visual(options);
        }
        throw 'Visual instance not found';
    },
    createModalDialog: (dialogId: string, options: DialogConstructorOptions, initialState: object) => {
        const dialogRegistry = (<any>globalThis).dialogRegistry;
        if (dialogId in dialogRegistry) {
            new dialogRegistry[dialogId](options, initialState);
        }
    },
    custom: true
};
if (typeof powerbi !== "undefined") {
    powerbi.visuals = powerbi.visuals || {};
    powerbi.visuals.plugins = powerbi.visuals.plugins || {};
    powerbi.visuals.plugins["SynopticPanelE2B5B9B6B0B14B8C8B0E6C0A7D6A1F01"] = SynopticPanelE2B5B9B6B0B14B8C8B0E6C0A7D6A1F01;
}
export default SynopticPanelE2B5B9B6B0B14B8C8B0E6C0A7D6A1F01;