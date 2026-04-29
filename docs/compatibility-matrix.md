# Compatibility Matrix - Certified Release vs `SVG Synoptic Map`

## Goal

Document backward compatibility for reports built with certified production visual and opened with current update package.

## Identity

- Previous production `visual.name`: `geosynoptic`
- Current production `visual.name`: `geosynoptic`
- Production GUID: `SynopticPanelE2B5B9B6B0B14B8C8B0E6C0A7D6A1F01`
- Public `displayName`: changed to `SVG Synoptic Map`

## Capabilities delta

| Area | Previous certified package | Current package | Impact |
| --- | --- | --- | --- |
| `dataRoles.colorBy` | Present | Removed | Medium. Old reports must continue opening without field-binding failure. Theme colors now use `legend` or `category`. |
| `dataRoles.legend` | Absent in earliest certified baseline | Present | Low. Additive. |
| `advancedEditModeSupport` | `1` | `2` | Low. Additive host capability. |
| `supportsKeyboardFocus` | Absent in earliest baseline | `true` | Low. Additive. |
| `privileges.LocalStorage` | Absent in earliest baseline | Present | Low runtime risk, document-only concern. Used for local UI state. |
| `nativeAreaColors` | Absent in earliest baseline | Present | Low. Additive, enables conditional formatting. |
| Formatting cards | Fewer public cards | Public pane simplified, hidden technical cards preserved in schema | Low if object/property names remain stable. |

## Migration behavior

- `colorBy` bindings are no longer exposed in new reports.
- Existing persisted formatting objects remain readable because object/property identifiers were preserved.
- Hidden advanced settings remain in schema for compatibility even when removed from public format pane.
- Legacy callout side settings migrate to boolean allowed-side toggles.

## Validation checklist

### Old PBIX 1 - basic buckets
- Open report with old visual replaced by new package
- Validate render, selection, legend, labels, theme colors
- Validate no broken role-binding prompt

### Old PBIX 2 - advanced formatting
- Validate persisted formatting still applies
- Validate hidden technical settings do not crash or reset unexpectedly

### Old PBIX 3 - drill/editor usage
- Validate drill path still resolves correctly
- Validate editor still opens in supported host

## Current evidence

- One old PBIX already tested manually by product owner and reported as working correctly.
- Remaining two scenarios still require explicit validation before submission.
