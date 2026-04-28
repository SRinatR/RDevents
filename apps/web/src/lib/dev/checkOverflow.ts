export function getHorizontalOverflowReport() {
  if (typeof window === 'undefined') return [];

  const viewportWidth = window.innerWidth;
  const elements = Array.from(document.querySelectorAll<HTMLElement>('body *'));

  return elements
    .map((element) => {
      const rect = element.getBoundingClientRect();

      return {
        tag: element.tagName.toLowerCase(),
        className: element.className,
        id: element.id,
        left: rect.left,
        right: rect.right,
        width: rect.width,
      };
    })
    .filter((item) => item.right > viewportWidth + 1 || item.left < -1)
    .slice(0, 50);
}
