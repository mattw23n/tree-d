declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    > & {
      src?: string;
      poster?: string;
      alt?: string;
      exposure?: string | number;
      'shadow-intensity'?: string | number;
      'camera-controls'?: boolean | string;
      'auto-rotate'?: boolean | string;
    };
  }
}
