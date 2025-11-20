import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
}

interface ParticleBackgroundProps {
  navbarOnly?: boolean;
}

const ParticleBackground: React.FC<ParticleBackgroundProps> = ({ navbarOnly = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      if (navbarOnly) {
        // For navbar, limit to navbar height
        canvas.width = window.innerWidth;
        canvas.height = 80; // Approximate navbar height
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize particles
    const initParticles = () => {
      particlesRef.current = [];
      let particleCount;
      
      if (navbarOnly) {
        // For navbar, use fewer particles
        particleCount = Math.floor((canvas.width * canvas.height) / 80000);
      } else if (window.innerWidth < 480) {
        // Very small screens - minimal particles
        particleCount = Math.floor((canvas.width * canvas.height) / 40000);
      } else if (window.innerWidth < 768) {
        // Mobile screens - fewer particles
        particleCount = Math.floor((canvas.width * canvas.height) / 30000);
      } else if (window.innerWidth < 1024) {
        // Tablet screens - medium particles
        particleCount = Math.floor((canvas.width * canvas.height) / 20000);
      } else {
        // Desktop screens - full particles
        particleCount = Math.floor((canvas.width * canvas.height) / 15000);
      }
      
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 2.5 + 0.8,
          opacity: Math.random() * 0.6 + 0.2,
          color: `hsl(${Math.random() * 60 + 20}, 70%, 60%)`, // Orange to yellow range
        });
      }
    };

    initParticles();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((particle, index) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Draw particle
        ctx.save();
        ctx.globalAlpha = particle.opacity;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw connections to nearby particles
        particlesRef.current.slice(index + 1).forEach(otherParticle => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            ctx.save();
            ctx.globalAlpha = (100 - distance) / 100 * 0.2;
            ctx.strokeStyle = particle.color;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.stroke();
            ctx.restore();
          }
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute pointer-events-none ${navbarOnly ? 'top-0 left-0 right-0 h-20 opacity-60' : 'inset-0 opacity-40'}`}
      style={{ 
        zIndex: navbarOnly ? 1 : 0, 
        maxWidth: '100vw', 
        maxHeight: navbarOnly ? '80px' : '100vh' 
      }}
    />
  );
};

export default ParticleBackground;
