import powerbi from "powerbi-visuals-api";
import DataView = powerbi.DataView;
export declare class AreaSettings {
    unmatchedFill: string;
    matchedFill: string;
}
export declare class SvgSettings {
    svgText: string;
    defaultFill: string;
    labelShow: boolean;
    labelMin: number;
    labelMax: number;
    labelBold: boolean;
    /** fator do contorno em relação ao tamanho da fonte (ex.: 0.12 = 12%) */
    labelOutlineFactor: number;
}
export declare class OutlineSettings {
    show: boolean;
    color: string;
    width: number;
}
export declare class VisualSettings {
    area: AreaSettings;
    svgSettings: SvgSettings;
    outline: OutlineSettings;
    static parse(dataView?: DataView): VisualSettings;
}
