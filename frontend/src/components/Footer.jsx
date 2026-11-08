// Este archivo se encarga del pie de página: enlaces legales y copyright, con una animación de
// aparición cuando el footer entra en pantalla.
import { useEffect, useRef, useState } from 'react';
import { Link } from "react-router-dom";
import '../styles/Footer.css';

// Este componente se encarga de renderizar el pie de página y detectar cuándo se hace visible.
function Footer() {
  const footerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const year = new Date().getFullYear();

  // Este useEffect se encarga de observar el footer y marcarlo como visible al entrar en el viewport.
  useEffect(() => {
    const node = footerRef.current;
    if (!node) return undefined;

    // Usa IntersectionObserver: activa la animación cuando al menos el 20% del footer es visible.
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
          <Link to="/privacy-policy" className="footer__link">
            Política de Privacidad
          </Link>
          <span className="footer__divider" aria-hidden="true">
            ·
          </span>
          <Link to="/terms" className="footer__link">
            Términos y Condiciones
          </Link>
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
