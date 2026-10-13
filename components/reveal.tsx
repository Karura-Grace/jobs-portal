"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Scroll-driven section reveal — fadeInUp, once (brief §1).
 *
 * `useReducedMotion` is checked rather than relying only on the CSS override in
 * globals.css: that override neutralises duration, which would leave a Framer
 * element stuck at its initial opacity: 0. Here the motion is skipped entirely
 * and content renders in place.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}
