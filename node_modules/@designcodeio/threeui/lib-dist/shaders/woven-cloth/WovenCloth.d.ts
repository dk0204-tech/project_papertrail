import { type NeuformCraftEffectProps } from "../neuform-isolated/NeuformCraftEffects";
export declare const WOVEN_CLOTH_VARIANTS: readonly ["woven-cloth", "iridescent", "atelier", "washi"];
export type WovenClothVariant = (typeof WOVEN_CLOTH_VARIANTS)[number];
export type WovenClothProps = NeuformCraftEffectProps & {
    variant?: WovenClothVariant;
};
export declare function WovenCloth({ variant, ...props }: WovenClothProps): import("react").JSX.Element;
//# sourceMappingURL=WovenCloth.d.ts.map