"use client";
import { useEffect, useRef, useState } from "react";

type ParticleType = "flames" | "stars" | "sparkles" | "embers" | "aurora" | "matrix" | "snow" | "rain";

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
    hue?: number;
    life: number;
    maxLife: number;
}

interface ParticlesProps {
    type?: ParticleType;
    className?: string;
    intensity?: number;
    color?: string;
}

export function Particles({ type = "flames", className = "", intensity = 50, color }: ParticlesProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const particlesRef = useRef<Particle[]>([]);
    const animationRef = useRef<number>(0);

    useEffect(() => {
        const updateDimensions = () => {
            if (canvasRef.current) {
                const rect = canvasRef.current.parentElement?.getBoundingClientRect();
                if (rect) {
                    setDimensions({ width: rect.width, height: rect.height });
                }
            }
        };

        updateDimensions();
        window.addEventListener("resize", updateDimensions);
        return () => window.removeEventListener("resize", updateDimensions);
    }, []);

    useEffect(() => {
        if (!canvasRef.current || dimensions.width === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = dimensions.width;
        canvas.height = dimensions.height;

        const createParticle = (): Particle => {
            switch (type) {
                case "flames":
                    return {
                        x: Math.random() * dimensions.width,
                        y: dimensions.height + 10,
                        vx: (Math.random() - 0.5) * 2,
                        vy: -(Math.random() * 3 + 2),
                        size: Math.random() * 20 + 10,
                        opacity: Math.random() * 0.6 + 0.2,
                        hue: Math.random() * 40 + 10,
                        life: 0,
                        maxLife: Math.random() * 100 + 100,
                    };
                case "stars":
                    return {
                        x: Math.random() * dimensions.width,
                        y: Math.random() * dimensions.height,
                        vx: (Math.random() - 0.5) * 0.2,
                        vy: (Math.random() - 0.5) * 0.2,
                        size: Math.random() * 2 + 0.5,
                        opacity: Math.random(),
                        life: 0,
                        maxLife: Math.random() * 200 + 100,
                    };
                case "sparkles":
                    return {
                        x: Math.random() * dimensions.width,
                        y: Math.random() * dimensions.height,
                        vx: (Math.random() - 0.5) * 1,
                        vy: (Math.random() - 0.5) * 1,
                        size: Math.random() * 3 + 1,
                        opacity: Math.random(),
                        hue: Math.random() * 60 + 40,
                        life: 0,
                        maxLife: Math.random() * 150 + 50,
                    };
                case "embers":
                    return {
                        x: Math.random() * dimensions.width,
                        y: Math.random() * dimensions.height * 0.7,
                        vx: (Math.random() - 0.5) * 0.5,
                        vy: Math.random() * 0.5 + 0.2,
                        size: Math.random() * 4 + 1,
                        opacity: Math.random(),
                        hue: Math.random() * 30 + 15,
                        life: 0,
                        maxLife: Math.random() * 300 + 200,
                    };
                case "aurora":
                    return {
                        x: Math.random() * dimensions.width,
                        y: Math.random() * dimensions.height * 0.6,
                        vx: (Math.random() - 0.5) * 0.3,
                        vy: (Math.random() - 0.5) * 0.1,
                        size: Math.random() * 100 + 50,
                        opacity: Math.random() * 0.3 + 0.1,
                        hue: Math.random() * 60 + 160,
                        life: 0,
                        maxLife: Math.random() * 200 + 100,
                    };
                case "matrix":
                    return {
                        x: Math.random() * dimensions.width,
                        y: Math.random() * dimensions.height,
                        vx: 0,
                        vy: Math.random() * 2 + 1,
                        size: Math.random() * 10 + 8,
                        opacity: Math.random(),
                        hue: 120,
                        life: 0,
                        maxLife: Math.random() * 50 + 30,
                    };
                case "snow":
                    return {
                        x: Math.random() * dimensions.width,
                        y: -10,
                        vx: (Math.random() - 0.5) * 1,
                        vy: Math.random() * 1 + 0.5,
                        size: Math.random() * 3 + 1,
                        opacity: Math.random() * 0.6 + 0.4,
                        life: 0,
                        maxLife: Math.random() * 500 + 300,
                    };
                case "rain":
                    return {
                        x: Math.random() * dimensions.width,
                        y: -20,
                        vx: 0,
                        vy: Math.random() * 10 + 8,
                        size: Math.random() * 1.5 + 0.5,
                        opacity: Math.random() * 0.3 + 0.2,
                        life: 0,
                        maxLife: Math.random() * 50 + 30,
                    };
                default:
                    return {
                        x: Math.random() * dimensions.width,
                        y: Math.random() * dimensions.height,
                        vx: (Math.random() - 0.5) * 1,
                        vy: (Math.random() - 0.5) * 1,
                        size: Math.random() * 3 + 1,
                        opacity: Math.random(),
                        life: 0,
                        maxLife: Math.random() * 100 + 50,
                    };
            }
        };

        const initParticles = () => {
            particlesRef.current = [];
            const count = Math.min(intensity, 150);
            for (let i = 0; i < count; i++) {
                particlesRef.current.push(createParticle());
            }
        };

        const drawFlames = (p: Particle) => {
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            const alpha = (1 - p.life / p.maxLife) * p.opacity;
            
            if (color) {
                gradient.addColorStop(0, `${color}${Math.floor(alpha * 255).toString(16).padStart(2, "0")}`);
                gradient.addColorStop(0.4, `${color}${Math.floor(alpha * 128).toString(16).padStart(2, "0")}`);
                gradient.addColorStop(1, "transparent");
            } else {
                gradient.addColorStop(0, `hsla(${p.hue}, 100%, 60%, ${alpha})`);
                gradient.addColorStop(0.4, `hsla(${p.hue}, 100%, 50%, ${alpha * 0.6})`);
                gradient.addColorStop(1, "transparent");
            }
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        };

        const drawStars = (p: Particle) => {
            const alpha = (Math.sin(p.life * 0.05) + 1) / 2 * p.opacity;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        };

        const drawSparkles = (p: Particle) => {
            const alpha = (1 - p.life / p.maxLife) * p.opacity;
            const spike = 4;
            const outerRadius = p.size;
            const innerRadius = p.size / 2;
            
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.life * 0.02);
            
            ctx.fillStyle = color 
                ? `${color}${Math.floor(alpha * 255).toString(16).padStart(2, "0")}`
                : `hsla(${p.hue}, 80%, 70%, ${alpha})`;
            
            ctx.beginPath();
            for (let i = 0; i < spike * 2; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (i * Math.PI) / spike;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        };

        const drawEmbers = (p: Particle) => {
            const alpha = (1 - p.life / p.maxLife) * p.opacity;
            ctx.fillStyle = color 
                ? `${color}${Math.floor(alpha * 255).toString(16).padStart(2, "0")}`
                : `hsla(${p.hue}, 100%, 60%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            
            // Glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = color || `hsla(${p.hue}, 100%, 60%, 1)`;
            ctx.fill();
            ctx.shadowBlur = 0;
        };

        const drawAurora = (p: Particle) => {
            const alpha = (Math.sin(p.life * 0.03) + 1) / 2 * p.opacity;
            const gradient = ctx.createLinearGradient(p.x - p.size, p.y, p.x + p.size, p.y);
            gradient.addColorStop(0, "transparent");
            gradient.addColorStop(0.5, `hsla(${p.hue}, 70%, 60%, ${alpha})`);
            gradient.addColorStop(1, "transparent");
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.size, p.size * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
        };

        const drawMatrix = (p: Particle) => {
            const alpha = (1 - p.life / p.maxLife) * p.opacity;
            const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
            const char = chars[Math.floor(Math.random() * chars.length)];
            
            ctx.fillStyle = `rgba(0, 255, 70, ${alpha})`;
            ctx.font = `${p.size}px monospace`;
            ctx.fillText(char, p.x, p.y);
        };

        const drawSnow = (p: Particle) => {
            const alpha = p.opacity;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        };

        const drawRain = (p: Particle) => {
            const alpha = p.opacity;
            ctx.strokeStyle = `rgba(174, 194, 224, ${alpha})`;
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 3, p.y + p.size * 10);
            ctx.stroke();
        };

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            particlesRef.current.forEach((p, index) => {
                p.life++;
                
                switch (type) {
                    case "flames":
                        p.x += p.vx;
                        p.y += p.vy;
                        p.vx += (Math.random() - 0.5) * 0.2;
                        p.size *= 0.99;
                        drawFlames(p);
                        break;
                    case "stars":
                        p.x += p.vx;
                        p.y += p.vy;
                        if (p.x < 0) p.x = dimensions.width;
                        if (p.x > dimensions.width) p.x = 0;
                        if (p.y < 0) p.y = dimensions.height;
                        if (p.y > dimensions.height) p.y = 0;
                        drawStars(p);
                        break;
                    case "sparkles":
                        p.x += p.vx;
                        p.y += p.vy;
                        drawSparkles(p);
                        break;
                    case "embers":
                        p.x += p.vx;
                        p.y += p.vy;
                        if (p.y > dimensions.height * 0.8) {
                            p.vy = -Math.abs(p.vy);
                        }
                        drawEmbers(p);
                        break;
                    case "aurora":
                        p.x += p.vx;
                        p.y += p.vy;
                        if (p.x < 0) p.x = dimensions.width;
                        if (p.x > dimensions.width) p.x = 0;
                        drawAurora(p);
                        break;
                    case "matrix":
                        p.y += p.vy;
                        drawMatrix(p);
                        break;
                    case "snow":
                        p.x += p.vx;
                        p.y += p.vy;
                        drawSnow(p);
                        break;
                    case "rain":
                        p.y += p.vy;
                        drawRain(p);
                        break;
                }
                
                // Reset particle if dead
                if (p.life >= p.maxLife) {
                    particlesRef.current[index] = createParticle();
                }
            });
            
            animationRef.current = requestAnimationFrame(animate);
        };

        initParticles();
        animate();

        return () => {
            cancelAnimationFrame(animationRef.current);
        };
    }, [dimensions, type, intensity, color]);

    return (
        <canvas
            ref={canvasRef}
            className={`absolute inset-0 pointer-events-none ${className}`}
            style={{ zIndex: 0 }}
        />
    );
}

// Pre-configured particle backgrounds for different sections
export function FlameParticles({ className }: { className?: string }) {
    return <Particles type="flames" className={className} intensity={40} />;
}

export function StarParticles({ className }: { className?: string }) {
    return <Particles type="stars" className={className} intensity={80} />;
}

export function SparkleParticles({ className }: { className?: string }) {
    return <Particles type="sparkles" className={className} intensity={30} color="#fbbf24" />;
}

export function EmberParticles({ className }: { className?: string }) {
    return <Particles type="embers" className={className} intensity={50} />;
}

export function AuroraParticles({ className }: { className?: string }) {
    return <Particles type="aurora" className={className} intensity={15} />;
}

export function MatrixParticles({ className }: { className?: string }) {
    return <Particles type="matrix" className={className} intensity={30} />;
}

export function SnowParticles({ className }: { className?: string }) {
    return <Particles type="snow" className={className} intensity={60} />;
}

export function RainParticles({ className }: { className?: string }) {
    return <Particles type="rain" className={className} intensity={100} />;
}
