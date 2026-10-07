import { StyleSheet, Text, View } from 'react-native'

import type { FixStatus } from './client'

export type Tracked = { id: string; comment: string | null; status: FixStatus | 'unreachable' }

const LOOK: Record<Tracked['status'], { label: string; color: string }> = {
  queued: { label: 'queued', color: '#ffcc00' },
  fixing: { label: 'fixing', color: '#5ac8fa' },
  rebuilding: { label: 'rebuilding', color: '#af52de' },
  live: { label: 'live', color: '#34c759' },
  stopped: { label: 'not on screen', color: '#ff3b30' },
  unreachable: { label: 'Claude Code is not listening: run claude in the project', color: '#ff3b30' },
}

/** One line per fix request, following it until it is live. */
export function Banners({ tracked }: { tracked: Tracked[] }) {
  if (tracked.length === 0) return null
  return (
    <View pointerEvents="none" style={styles.stack}>
      {tracked.map(one => {
        const look = LOOK[one.status]
        return (
          <View key={one.id} accessibilityRole="alert" style={styles.banner}>
            <View style={[styles.dot, { backgroundColor: look.color }]} />
            <Text style={styles.text} numberOfLines={1}>
              {one.status === 'unreachable' ? look.label : `${one.id} ${look.label}${one.comment ? ` · ${one.comment}` : ''}`}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', top: 54, left: 16, right: 16, gap: 6, alignItems: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    backgroundColor: 'rgba(28,28,30,0.92)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: '#fff', fontSize: 13, flexShrink: 1 },
})
