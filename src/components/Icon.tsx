import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

export type IconName = string;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: ViewStyle | TextStyle;
}

export function UniversalIcon({ name, size = 20, color = '#191C1E', style }: IconProps) {
  const s = size;

  switch (name) {
    // 1. Dashboard 2x2 grid
    case 'dashboard': {
      const boxSize = Math.max(3, Math.floor(s * 0.4));
      return (
        <View
          style={[
            {
              width: s,
              height: s,
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignContent: 'space-between',
              padding: Math.floor(s * 0.05),
            },
            style,
          ]}
        >
          <View style={{ width: boxSize, height: boxSize, backgroundColor: color, borderRadius: 2 }} />
          <View style={{ width: boxSize, height: boxSize, backgroundColor: color, borderRadius: 2 }} />
          <View style={{ width: boxSize, height: boxSize, backgroundColor: color, borderRadius: 2 }} />
          <View style={{ width: boxSize, height: boxSize, backgroundColor: color, borderRadius: 2 }} />
        </View>
      );
    }

    // 2. QR Code Scanner reticle
    case 'qr-code-scanner':
    case 'center-focus-weak': {
      const corner = Math.max(4, Math.floor(s * 0.32));
      const border = Math.max(1.5, Math.floor(s * 0.1));
      return (
        <View
          style={[
            {
              width: s,
              height: s,
              position: 'relative',
              alignItems: 'center',
              justifyContent: 'center',
            },
            style,
          ]}
        >
          {/* Top-Left */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: corner,
              height: corner,
              borderTopWidth: border,
              borderLeftWidth: border,
              borderColor: color,
              borderTopLeftRadius: 2,
            }}
          />
          {/* Top-Right */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: corner,
              height: corner,
              borderTopWidth: border,
              borderRightWidth: border,
              borderColor: color,
              borderTopRightRadius: 2,
            }}
          />
          {/* Bottom-Left */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: corner,
              height: corner,
              borderBottomWidth: border,
              borderLeftWidth: border,
              borderColor: color,
              borderBottomLeftRadius: 2,
            }}
          />
          {/* Bottom-Right */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: corner,
              height: corner,
              borderBottomWidth: border,
              borderRightWidth: border,
              borderColor: color,
              borderBottomRightRadius: 2,
            }}
          />
          {/* Center scan beam */}
          <View
            style={{
              width: Math.floor(s * 0.58),
              height: Math.max(1.5, Math.floor(s * 0.08)),
              backgroundColor: color,
              borderRadius: 1,
            }}
          />
        </View>
      );
    }

    // 3. User / Person
    case 'person':
    case 'account-circle':
    case 'person-pin':
    case 'groups': {
      const head = Math.floor(s * 0.42);
      const bodyW = Math.floor(s * 0.72);
      const bodyH = Math.floor(s * 0.32);
      return (
        <View
          style={[
            {
              width: s,
              height: s,
              alignItems: 'center',
              justifyContent: 'center',
            },
            style,
          ]}
        >
          <View
            style={{
              width: head,
              height: head,
              borderRadius: head / 2,
              backgroundColor: color,
              marginBottom: Math.floor(s * 0.05),
            }}
          />
          <View
            style={{
              width: bodyW,
              height: bodyH,
              borderTopLeftRadius: Math.floor(bodyW / 2),
              borderTopRightRadius: Math.floor(bodyW / 2),
              backgroundColor: color,
            }}
          />
        </View>
      );
    }

    // 4. Records / List / History
    case 'history':
    case 'records':
    case 'receipt-long': {
      const lineH = Math.max(1.8, Math.floor(s * 0.09));
      return (
        <View
          style={[
            {
              width: s,
              height: s,
              justifyContent: 'center',
              gap: Math.floor(s * 0.12),
              paddingHorizontal: Math.floor(s * 0.12),
            },
            style,
          ]}
        >
          <View style={{ height: lineH, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ height: lineH, backgroundColor: color, borderRadius: 1, width: '70%' }} />
          <View style={{ height: lineH, backgroundColor: color, borderRadius: 1, width: '90%' }} />
        </View>
      );
    }

    // 5. Institution / Centre / Domain
    case 'domain':
    case 'apartment':
    case 'domain-verification': {
      const w = Math.floor(s * 0.82);
      const h = Math.floor(s * 0.52);
      return (
        <View
          style={[
            {
              width: s,
              height: s,
              alignItems: 'center',
              justifyContent: 'center',
            },
            style,
          ]}
        >
          {/* Triangular pediment roof */}
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: Math.floor(w / 2),
              borderRightWidth: Math.floor(w / 2),
              borderBottomWidth: Math.floor(s * 0.22),
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: color,
            }}
          />
          {/* Pillars */}
          <View
            style={{
              width: w,
              height: h,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottomWidth: Math.max(1.5, Math.floor(s * 0.08)),
              borderBottomColor: color,
              paddingHorizontal: 2,
            }}
          >
            <View style={{ width: Math.max(1.5, Math.floor(s * 0.09)), height: '90%', backgroundColor: color }} />
            <View style={{ width: Math.max(1.5, Math.floor(s * 0.09)), height: '90%', backgroundColor: color }} />
            <View style={{ width: Math.max(1.5, Math.floor(s * 0.09)), height: '90%', backgroundColor: color }} />
          </View>
        </View>
      );
    }

    // 6. Camera
    case 'photo-camera':
    case 'camera-front': {
      const camW = Math.floor(s * 0.84);
      const camH = Math.floor(s * 0.6);
      const lens = Math.floor(s * 0.32);
      return (
        <View
          style={[
            {
              width: s,
              height: s,
              alignItems: 'center',
              justifyContent: 'center',
            },
            style,
          ]}
        >
          <View
            style={{
              width: camW,
              height: camH,
              borderRadius: 3,
              borderWidth: Math.max(1.5, Math.floor(s * 0.09)),
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: lens,
                height: lens,
                borderRadius: lens / 2,
                borderWidth: Math.max(1.5, Math.floor(s * 0.09)),
                borderColor: color,
              }}
            />
          </View>
        </View>
      );
    }

    // 7. Check-circle badge
    case 'check-circle': {
      return (
        <View
          style={[
            {
              width: s,
              height: s,
              borderRadius: s / 2,
              backgroundColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            },
            style,
          ]}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: Math.floor(s * 0.65),
              fontWeight: '900',
              lineHeight: Math.floor(s * 0.75),
            }}
          >
            ✓
          </Text>
        </View>
      );
    }

    // 8. My location / Target reticle
    case 'my-location':
    case 'filter-center-focus':
    case 'location-searching': {
      const outer = Math.floor(s * 0.78);
      const inner = Math.floor(s * 0.28);
      return (
        <View
          style={[
            {
              width: s,
              height: s,
              alignItems: 'center',
              justifyContent: 'center',
            },
            style,
          ]}
        >
          <View
            style={{
              width: outer,
              height: outer,
              borderRadius: outer / 2,
              borderWidth: Math.max(1.5, Math.floor(s * 0.09)),
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: inner,
                height: inner,
                borderRadius: inner / 2,
                backgroundColor: color,
              }}
            />
          </View>
        </View>
      );
    }

    // 9. Arrow back
    case 'arrow-back': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text
            style={{
              color,
              fontSize: Math.floor(s * 0.95),
              fontWeight: '700',
              lineHeight: s,
              textAlign: 'center',
            }}
          >
            ←
          </Text>
        </View>
      );
    }

    // 10. Arrow forward
    case 'arrow-forward': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text
            style={{
              color,
              fontSize: Math.floor(s * 0.95),
              fontWeight: '700',
              lineHeight: s,
              textAlign: 'center',
            }}
          >
            →
          </Text>
        </View>
      );
    }

    // 11. Chevron right
    case 'arrow-forward-ios':
    case 'chevron-right': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text
            style={{
              color,
              fontSize: Math.floor(s * 0.85),
              fontWeight: '800',
              lineHeight: s,
              textAlign: 'center',
            }}
          >
            ›
          </Text>
        </View>
      );
    }

    // 12. Check
    case 'check': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text
            style={{
              color,
              fontSize: Math.floor(s * 0.95),
              fontWeight: '900',
              lineHeight: s,
              textAlign: 'center',
            }}
          >
            ✓
          </Text>
        </View>
      );
    }

    // 13. Close
    case 'close': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text
            style={{
              color,
              fontSize: Math.floor(s * 0.85),
              fontWeight: '800',
              lineHeight: s,
              textAlign: 'center',
            }}
          >
            ✕
          </Text>
        </View>
      );
    }

    // 14. Sync / Refresh
    case 'sync':
    case 'refresh': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text
            style={{
              color,
              fontSize: Math.floor(s * 0.9),
              fontWeight: '800',
              lineHeight: s,
              textAlign: 'center',
            }}
          >
            ↻
          </Text>
        </View>
      );
    }

    // 15. Flash / Bolt
    case 'bolt':
    case 'offline-bolt':
    case 'flash-on': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text
            style={{
              color,
              fontSize: Math.floor(s * 0.85),
              fontWeight: '700',
              lineHeight: s,
              textAlign: 'center',
            }}
          >
            ⚡
          </Text>
        </View>
      );
    }

    // 16. Flash off
    case 'flash-off': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text
            style={{
              color,
              fontSize: Math.floor(s * 0.75),
              fontWeight: '700',
              lineHeight: s,
              textAlign: 'center',
              textDecorationLine: 'line-through',
            }}
          >
            ⚡
          </Text>
        </View>
      );
    }

    // 17. Error / Warning
    case 'error':
    case 'error-outline':
    case 'warning':
    case 'block': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text
            style={{
              color,
              fontSize: Math.floor(s * 0.85),
              fontWeight: '800',
              lineHeight: s,
              textAlign: 'center',
            }}
          >
            ⚠
          </Text>
        </View>
      );
    }

    // 18. Location On
    case 'location-on':
    case 'location-city': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ fontSize: Math.floor(s * 0.8), textAlign: 'center' }}>📍</Text>
        </View>
      );
    }

    // 19. Location Off / Wrong Location
    case 'wrong-location':
    case 'location-off': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ color, fontSize: Math.floor(s * 0.8), fontWeight: '700', textAlign: 'center' }}>⌖✕</Text>
        </View>
      );
    }

    // 20. Fingerprint / Biometric
    case 'fingerprint': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ fontSize: Math.floor(s * 0.8), textAlign: 'center' }}>👆</Text>
        </View>
      );
    }

    // 21. Door / Room
    case 'meeting-room':
    case 'sensor-door': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ fontSize: Math.floor(s * 0.8), textAlign: 'center' }}>🚪</Text>
        </View>
      );
    }

    // 22. Schedule / Timer
    case 'schedule':
    case 'timer':
    case 'hourglass-top': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ fontSize: Math.floor(s * 0.8), textAlign: 'center' }}>⏱</Text>
        </View>
      );
    }

    // 23. Search
    case 'search':
    case 'search-off': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ fontSize: Math.floor(s * 0.8), textAlign: 'center' }}>🔍</Text>
        </View>
      );
    }

    // 24. Verified / Shield
    case 'verified-user':
    case 'verified':
    case 'security': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ fontSize: Math.floor(s * 0.8), textAlign: 'center' }}>🛡</Text>
        </View>
      );
    }

    // 25. Badge / Credentials
    case 'badge':
    case 'assignment-ind':
    case 'assignment-turned-in':
    case 'how-to-reg': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ fontSize: Math.floor(s * 0.8), textAlign: 'center' }}>🪪</Text>
        </View>
      );
    }

    // 26. Content Copy
    case 'content-copy': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ color, fontSize: Math.floor(s * 0.8), fontWeight: '700', textAlign: 'center' }}>⎘</Text>
        </View>
      );
    }

    // 27. Keyboard
    case 'keyboard': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ fontSize: Math.floor(s * 0.8), textAlign: 'center' }}>⌨</Text>
        </View>
      );
    }

    // 28. Logout
    case 'logout': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ color, fontSize: Math.floor(s * 0.8), fontWeight: '800', textAlign: 'center' }}>↪</Text>
        </View>
      );
    }

    // 29. Cloud off
    case 'cloud-off': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ color, fontSize: Math.floor(s * 0.8), textAlign: 'center' }}>☁✕</Text>
        </View>
      );
    }

    // 30. Tips and updates
    case 'tips-and-updates': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ fontSize: Math.floor(s * 0.8), textAlign: 'center' }}>💡</Text>
        </View>
      );
    }

    // 31. Support Agent
    case 'support-agent': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ fontSize: Math.floor(s * 0.8), textAlign: 'center' }}>🎧</Text>
        </View>
      );
    }

    // 32. Person off
    case 'person-off': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ color, fontSize: Math.floor(s * 0.8), textAlign: 'center' }}>👤✕</Text>
        </View>
      );
    }

    // 33. Login
    case 'login': {
      return (
        <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ color, fontSize: Math.floor(s * 0.8), fontWeight: '800', textAlign: 'center' }}>➔</Text>
        </View>
      );
    }

    // Default Fallback
    default: {
      return (
        <View
          style={[
            {
              width: s,
              height: s,
              alignItems: 'center',
              justifyContent: 'center',
            },
            style,
          ]}
        >
          <View
            style={{
              width: Math.floor(s * 0.6),
              height: Math.floor(s * 0.6),
              borderRadius: Math.floor(s * 0.3),
              backgroundColor: color,
            }}
          />
        </View>
      );
    }
  }
}

export const MaterialIcons = UniversalIcon;
export default UniversalIcon;
