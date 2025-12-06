import crypto from 'crypto';

/**
 * デバイス情報
 */
export interface DeviceInfo {
  fingerprint: string;
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
}

/**
 * User-AgentとIPアドレスからデバイスフィンガープリントを生成
 */
export function generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
  const data = `${userAgent}:${ipAddress}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * User-Agentからデバイスタイプを判定
 */
export function detectDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
  if (!userAgent) {
    return 'unknown';
  }

  const ua = userAgent.toLowerCase();

  // タブレット判定
  if (ua.includes('ipad') || (ua.includes('tablet') && !ua.includes('mobile'))) {
    return 'tablet';
  }

  // モバイル判定
  if (
    ua.includes('mobile') ||
    ua.includes('android') ||
    ua.includes('iphone') ||
    ua.includes('ipod') ||
    ua.includes('blackberry') ||
    ua.includes('windows phone')
  ) {
    return 'mobile';
  }

  // デスクトップ判定
  if (
    ua.includes('windows') ||
    ua.includes('macintosh') ||
    ua.includes('linux') ||
    ua.includes('x11')
  ) {
    return 'desktop';
  }

  return 'unknown';
}

/**
 * RequestからデバイスIPアドレスを取得
 */
export function getClientIpAddress(req: any): string {
  // プロキシ経由の場合
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // 直接接続の場合
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Requestからデバイス情報を取得
 */
export function getDeviceInfo(req: any): DeviceInfo {
  const userAgent = req.headers['user-agent'] || '';
  const ipAddress = getClientIpAddress(req);

  return {
    fingerprint: generateDeviceFingerprint(userAgent, ipAddress),
    type: detectDeviceType(userAgent),
  };
}
