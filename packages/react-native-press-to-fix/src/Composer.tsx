import { useState } from 'react'
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'

import type { Frame } from './inspect'

const RED = '#ff3b30'

/** The pressed element outlined in red, or a red ring where the finger was. */
export function Highlight({ frame, touch }: { frame: Frame | null; touch: { x: number; y: number } }) {
  if (frame && frame.width > 0 && frame.height > 0) {
    return <View pointerEvents="none" style={[styles.outline, frame]} />
  }
  return <View pointerEvents="none" style={[styles.ring, { left: touch.x - 22, top: touch.y - 22 }]} />
}

type Props = {
  frame: Frame | null
  touch: { x: number; y: number }
  label: string | null
  onSend: (comment: string) => void
  onCancel: () => void
}

/** Asks what is wrong with the pressed element. It sits on the half of the screen away from it. */
export function Composer({ frame, touch, label, onSend, onCancel }: Props) {
  const [comment, setComment] = useState('')
  const { height } = useWindowDimensions()
  const centre = frame ? frame.top + frame.height / 2 : touch.y
  const atBottom = centre < height / 2

  const card = (
    <View style={styles.card}>
      {label !== null && (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      )}
      <TextInput
        accessibilityLabel="What's wrong?"
        autoFocus
        blurOnSubmit
        onChangeText={setComment}
        onSubmitEditing={event => {
          // The input's own text: the last keystrokes may not be in state yet.
          const text = (event?.nativeEvent?.text ?? comment).trim()
          if (text) onSend(text)
          else onCancel()
        }}
        placeholder="What's wrong?"
        placeholderTextColor="#8e8e93"
        returnKeyType="send"
        style={styles.input}
        value={comment}
      />
    </View>
  )

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable accessibilityLabel="Cancel fix request" onPress={onCancel} style={[StyleSheet.absoluteFill, styles.backdrop]} />
      <Highlight frame={frame} touch={touch} />
      {atBottom ? (
        <KeyboardAvoidingView behavior="padding" pointerEvents="box-none" style={styles.bottom}>
          {card}
        </KeyboardAvoidingView>
      ) : (
        <View pointerEvents="box-none" style={styles.top}>
          {card}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.15)' },
  outline: { position: 'absolute', borderColor: RED, borderWidth: 2, borderRadius: 4 },
  ring: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderColor: RED, borderWidth: 3 },
  top: { position: 'absolute', top: 60, left: 16, right: 16 },
  bottom: { position: 'absolute', bottom: 24, left: 16, right: 16 },
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  label: { color: '#8e8e93', fontSize: 12, fontFamily: 'Menlo' },
  input: { color: '#fff', fontSize: 16, paddingVertical: 6 },
})
