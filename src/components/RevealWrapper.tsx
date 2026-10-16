"use client";

import { useEffect, useRef } from "react";

type RevealWrapperProps<T extends keyof React.JSX.IntrinsicElements> = {
  as?: T;
} & Omit<React.ComponentPropsWithoutRef<T>, "as">;

export default function RevealWrapper<
  T extends keyof React.JSX.IntrinsicElements = "div"
>({ as, className = "", children, ...rest }: RevealWrapperProps<T>) {
  const Tag = (as ?? "div") as React.ElementType;
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      el.classList.add("in");
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);

    return () => obs.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`reveal ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
