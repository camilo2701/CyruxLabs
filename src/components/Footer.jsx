import { useEffect, useRef, useState } from 'react';
import '../styles/Footer.css';

function Footer() {
  const footerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    const node = footerRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.2 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <footer ref={footerRef} className={`footer ${isVisible ? 'footer--visible' : ''}`}>
      <div className="footer__content">
        

        <nav className="footer__links" aria-label="Enlaces legales">
          <span className="footer__brand">
            CyruxLabs
          </span>
          <span className="footer__divider" aria-hidden="true">
            ·
          </span>
          <a href="/privacy-policy" className="footer__link">
            Política de Privacidad
          </a>
          <span className="footer__divider" aria-hidden="true">
            ·
          </span>
          <a href="/terms" className="footer__link">
            Términos y Condiciones
          </a>
          <span className="footer__divider" aria-hidden="true">
            ·
          </span>
          <span className="footer__copyright">
            © {year}
          </span>
        </nav>

        
      </div>
    </footer>
  );
}

export default Footer;
