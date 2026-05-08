import { useEffect, useRef } from "react";

/**
 * Drop-in wrapper that fades+slides its child into view when scrolled past.
 * Uses IntersectionObserver — zero deps, plays nice with React 19.
 *
 * Stagger by passing `delay={index * 80}`.  Respects
 * `prefers-reduced-motion` (handled in CSS).
 */
export default function ScrollReveal({
  as: Tag = "div",
  delay = 0,
  threshold = 0.18,
  rootMargin = "0px 0px -10% 0px",
  className = "",
  children,
  ...rest
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    // SSR / non-supporting browsers — just show.
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      el.classList.add("reveal--in");
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("reveal--in");
            io.unobserve(el);   // one-shot — no flicker on scroll back up
          }
        }
      },
      { threshold, rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      style={{ "--reveal-delay": `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
