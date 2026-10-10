import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Text, View } from "react-native";
import { colors } from "../theme";

/**
 * Long-press-and-drag between drop zones, built on PanResponder (no extra
 * libraries). Press and hold an item ~0.3s, drag it onto a drop zone, release.
 * A quick tap still counts as a tap. While dragging, the screen's ScrollView
 * should be disabled (use `dragging` from useDrag()).
 */

export type DragItem = { id: string; label: string; icon: string };
type Rect = { x: number; y: number; w: number; h: number };

type Ctx = {
  dragging: DragItem | null;
  hover: string | null;
  registerDrop: (key: string, ref: React.RefObject<View>) => () => void;
  begin: (item: DragItem, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  end: (x: number, y: number) => void;
  cancel: () => void;
};

const DragCtx = createContext<Ctx | null>(null);
export const useDrag = () => {
  const c = useContext(DragCtx);
  if (!c) throw new Error("useDrag outside DragProvider");
  return c;
};

const CHIP_W = 150;
const CHIP_H = 44;

export function DragProvider({ onDrop, children }: { onDrop: (itemId: string, dropKey: string) => void; children: React.ReactNode }) {
  const drops = useRef(new Map<string, React.RefObject<View>>());
  const rects = useRef(new Map<string, Rect>());
  const rootRef = useRef<View>(null);
  const root = useRef<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const pos = useRef(new Animated.ValueXY({ x: -500, y: -500 })).current;
  const [dragging, setDragging] = useState<DragItem | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  const draggingRef = useRef<DragItem | null>(null);

  const registerDrop = useCallback((key: string, ref: React.RefObject<View>) => {
    drops.current.set(key, ref);
    return () => {
      drops.current.delete(key);
      rects.current.delete(key);
    };
  }, []);

  const hit = (x: number, y: number): string | null => {
    for (const [key, r] of Array.from(rects.current.entries())) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return key;
    }
    return null;
  };

  const place = (x: number, y: number) => {
    pos.setValue({ x: x - root.current.x - CHIP_W / 2, y: y - root.current.y - CHIP_H - 12 });
  };

  const setHoverKey = (k: string | null) => {
    if (hoverRef.current !== k) {
      hoverRef.current = k;
      setHover(k);
    }
  };

  const api: Ctx = useMemo(
    () => ({
      dragging,
      hover,
      registerDrop,
      begin: (item, x, y) => {
        draggingRef.current = item;
        setDragging(item);
        rootRef.current?.measureInWindow((rx, ry, rw, rh) => {
          root.current = { x: rx, y: ry, w: rw, h: rh };
          place(x, y);
        });
        rects.current.clear();
        drops.current.forEach((ref, key) => {
          ref.current?.measureInWindow((rx, ry, rw, rh) => {
            rects.current.set(key, { x: rx, y: ry, w: rw, h: rh });
          });
        });
        place(x, y);
      },
      move: (x, y) => {
        place(x, y);
        setHoverKey(hit(x, y));
      },
      end: (x, y) => {
        const item = draggingRef.current;
        const key = hit(x, y);
        draggingRef.current = null;
        setDragging(null);
        setHoverKey(null);
        pos.setValue({ x: -500, y: -500 });
        if (item && key) onDrop(item.id, key);
      },
      cancel: () => {
        draggingRef.current = null;
        setDragging(null);
        setHoverKey(null);
        pos.setValue({ x: -500, y: -500 });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragging, hover, registerDrop, onDrop]
  );

  return (
    <DragCtx.Provider value={api}>
      <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
        {children}
        {dragging ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute", left: 0, top: 0, width: CHIP_W, height: CHIP_H, borderRadius: 22,
              backgroundColor: colors.brand, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8,
              transform: pos.getTranslateTransform(), shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8,
            }}
          >
            <Text style={{ fontSize: 20 }}>{dragging.icon}</Text>
            <Text numberOfLines={1} style={{ color: colors.onBrand, fontWeight: "800", flex: 1 }}>{dragging.label}</Text>
          </Animated.View>
        ) : null}
      </View>
    </DragCtx.Provider>
  );
}

/** Register a view as a drop zone. Returns the ref to attach and whether a drag is hovering it. */
export function useDropZone(key: string) {
  const { registerDrop, hover, dragging } = useDrag();
  const ref = useRef<View>(null);
  useEffect(() => registerDrop(key, ref), [key, registerDrop]);
  return { ref, isHover: hover === key, isDragging: !!dragging };
}

/** Wrap anything draggable. Quick tap calls onPress; press-and-hold then move starts a drag. */
export function Draggable({
  item, enabled = true, onPress, children, style,
}: { item: DragItem; enabled?: boolean; onPress?: () => void; children: React.ReactNode; style?: any }) {
  const drag = useDrag();
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const latest = useRef({ item, enabled, onPress });
  latest.current = { item, enabled, onPress };

  const state = useRef({ active: false, timer: null as any, startX: 0, startY: 0, startT: 0, moved: false });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => !state.current.active,
        onPanResponderGrant: (e) => {
          const s = state.current;
          s.active = false;
          s.moved = false;
          s.startX = e.nativeEvent.pageX;
          s.startY = e.nativeEvent.pageY;
          s.startT = Date.now();
          clearTimeout(s.timer);
          if (latest.current.enabled) {
            s.timer = setTimeout(() => {
              if (!s.moved) {
                s.active = true;
                dragRef.current.begin(latest.current.item, s.startX, s.startY);
              }
            }, 300);
          }
        },
        onPanResponderMove: (_e, g) => {
          const s = state.current;
          if (s.active) {
            dragRef.current.move(g.moveX, g.moveY);
          } else if (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8) {
            s.moved = true;
            clearTimeout(s.timer);
          }
        },
        onPanResponderRelease: (_e, g) => {
          const s = state.current;
          clearTimeout(s.timer);
          if (s.active) {
            s.active = false;
            dragRef.current.end(g.moveX || s.startX, g.moveY || s.startY);
          } else if (!s.moved && Date.now() - s.startT < 400) {
            latest.current.onPress?.();
          }
        },
        onPanResponderTerminate: () => {
          const s = state.current;
          clearTimeout(s.timer);
          if (s.active) {
            s.active = false;
            dragRef.current.cancel();
          }
        },
      }),
    []
  );

  const isThisDragging = drag.dragging?.id === item.id;
  return (
    <View {...responder.panHandlers} collapsable={false} style={[style, isThisDragging ? { opacity: 0.3 } : null]}>
      {children}
    </View>
  );
}
