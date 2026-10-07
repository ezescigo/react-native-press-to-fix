import type { FixReport, Incoming, Pressed } from '../types'

export declare const INSTRUCTIONS: string
export declare function describePressed(pressed: Pressed, components?: string[]): string
export declare function promptFor(incoming: Incoming, source: string | null): string
export declare function pressedLabel(report: Pick<FixReport, 'mark' | 'pressed' | 'components' | 'screen'>): string
export declare function isNativeRebuild(tool: string, command?: string): boolean
