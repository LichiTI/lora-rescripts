export function setText(id: string, text: string) {
  const element = document.querySelector<HTMLElement>(`#${id}`);
  if (element) {
    element.textContent = text;
  }
}

export function setHtml(id: string, html: string) {
  const element = document.querySelector<HTMLElement>(`#${id}`);
  if (element) {
    element.innerHTML = html;
  }
}

export function setPreText(id: string, text: string) {
  const element = document.querySelector<HTMLElement>(`#${id}`);
  if (element) {
    element.textContent = text;
  }
}
