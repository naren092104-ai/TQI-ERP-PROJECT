/**
 * useReveal — IntersectionObserver hook for scroll-entry animations.
 *
 * Applied to any element that carries the `tqi-reveal` class (or any
 * element you want to fade up on scroll). Uses `prefers-reduced-motion`
 * to short-circuit and runs only once per element.
 *
 * Usage:
 *   const ref = useReveal<HTMLDivElement>();
 *   <div ref={ref} className="tqi-reveal">…</div>
 *
 * Or with the higher-level <Reveal> component:
 *   <Reveal as="div" className="tqi-reveal">…</Reveal>
 */
import { createElement, useEffect, useRef, useState, type ElementType, type RefObject } from 'react';

interface UseRevealOptions {
  /** Trigger when this fraction of the element is visible. Default 0.12. */
  threshold?: number;
  /** Root margin — useful for lazy reveal slightly before the element enters. */
  rootMargin?: string;
  /** When true, fires only once. Default true. */
  once?: boolean;
}

export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseRevealOptions = {}
): RefObject<T | null> {
  const { threshold = 0.12, rootMargin = '0px 0px -8% 0px', once = true } = options;
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  useEffect(() => {
    if (!ref.current) return;
    if (visible) {
      ref.current.classList.add('is-visible');
    } else {
      ref.current.classList.remove('is-visible');
    }
  }, [visible]);

  return ref;
}

interface RevealProps {
  as?: ElementType;
  className?: string;
  children?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  delayMs?: number;
}

/**
 * <Reveal> — declarative scroll-entry wrapper.
 * Composes with `.tqi-reveal` in CSS so the element starts hidden
 * and animates in once it crosses the viewport threshold.
 */
export const Reveal: React.FC<RevealProps> = ({
  as,
  className = '',
  children,
  threshold,
  rootMargin,
  delayMs,
}) => {
  const ref = useReveal<HTMLElement>({ threshold, rootMargin });
  const style = delayMs ? { animationDelay: `${delayMs}ms` } : undefined;
  const Comp: any = (as ?? 'div') as any;
  return createElement(
    Comp,
    { ref, className: `tqi-reveal ${className}`.trim(), style },
    children
  );
};
