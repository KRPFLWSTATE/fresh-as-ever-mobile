import { Share, Platform } from 'react-native';
import type React from 'react';
import ViewShot from 'react-native-view-shot';

type ViewShotHandle = React.ElementRef<typeof ViewShot>;

export type ShareCardPayload = {
  title: string;
  message: string;
  /** Local file URI from view-shot capture. */
  imageUri?: string | null;
};

export async function shareCardGraphic(payload: ShareCardPayload): Promise<'shared' | 'dismissed'> {
  const { title, message, imageUri } = payload;
  try {
    const result = await Share.share(
      imageUri
        ? Platform.select({
            ios: { url: imageUri, message },
            default: { title, message, url: imageUri },
          }) ?? { title, message }
        : { title, message },
      { dialogTitle: title, subject: title },
    );
    if (result.action === Share.dismissedAction) return 'dismissed';
    return 'shared';
  } catch {
    return 'dismissed';
  }
}

export async function captureViewShot(
  ref: React.RefObject<ViewShotHandle | null>,
): Promise<string | null> {
  const node = ref.current;
  if (!node?.capture) return null;
  try {
    const uri = await node.capture();
    return typeof uri === 'string' ? uri : null;
  } catch {
    return null;
  }
}
