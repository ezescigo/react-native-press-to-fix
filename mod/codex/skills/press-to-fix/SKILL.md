---
name: press-to-fix
description: Use when a prompt ends with a line starting "[fix r1]" (or r2, r3…): a fix request sent from the React Native app in the iOS simulator by press-to-fix, with the element's file and line and a screenshot.
---

# Fix requests from the running app

A prompt that ends with a line like

[fix r1] /app/src/menu/DrinkRow.tsx:15 · Text "$4.5" in <DrinkRow> in <MenuScreen> · /app/.fixmod/reports/r1.png
[fix r2] order.placeOrder · /app/src/order/OrderScreen.tsx:25 · Text "Place order" in <OrderScreen> · /app/.fixmod/reports/r2.png
[fix r3] View in <RewardsCard> · Rewards screen · /app/.fixmod/reports/r3.png

was sent from the React Native app running in the iOS simulator by press-to-fix: someone long-pressed an element and typed the text above that line. The line holds the report's id and what is known about the element: the name of the <Fixable name="…"> around it when the app marks it; the file and line of the JSX that rendered it; the host element (Text, View, Image…) with its text; the app's own components around it, innermost first; the screen's name when no line is known; and a screenshot with the element outlined in red, or a red ring where the finger was.

When a prompt carries that line:
- Treat the text above it as the request. It may be a bug ("button is shifted") or a change ("make this green").
- With a file and line, start there: the cause is on that element, its style, or the component that renders it.
- Without one, find the innermost named component and search the sources for it and the text; text made from data (an amount, a date) is found through the component that formats it.
- Styles may live in a StyleSheet at the bottom of the file, a theme module, or a className; follow them to where the value is set.
- Make the smallest change that does what was asked. Do not refactor.
- Open the screenshot only when the text and the code leave the request unclear.
- A JavaScript or TypeScript change reaches the screen through Fast Refresh: do not rebuild or relaunch the app for it. Rebuild (npx expo run:ios or npx react-native run-ios) only when the change touches native code, native dependencies or app config.
- Answer in one or two sentences: what was wrong and what changed.
