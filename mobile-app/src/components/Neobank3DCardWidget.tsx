import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Rotate3d, Share2, CheckCircle2, Loader2 } from 'lucide-react';

interface Neobank3DCardWidgetProps {
  finish?: 'gold' | 'titanium' | 'emerald';
}

export const Neobank3DCardWidget: React.FC<Neobank3DCardWidgetProps> = ({
  finish: initialFinish = 'gold',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeFinish, setActiveFinish] = useState<'gold' | 'titanium' | 'emerald'>(initialFinish);
  const finishRef = useRef<'gold' | 'titanium' | 'emerald'>(initialFinish);
  const pointerTargetRef = useRef<{ rx: number; ry: number }>({ rx: 0.12, ry: -0.35 });
  const snapshotRef = useRef<(() => string | null) | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  useEffect(() => {
    finishRef.current = activeFinish;
  }, [activeFinish]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect software WebGL per threejs skill directive
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 280;
    const height = container.clientHeight || 165;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    camera.position.set(0, 0.25, 4.4);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    snapshotRef.current = () => {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    };

    // 2. Studio Environment Map via RoomEnvironment + PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // 3. Warm Key Light + Cool Hemisphere Fill Light
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfde68a, 2.4);
    keyLight.position.set(3.5, 4.5, 4.0);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.3);
    rimLight.position.set(-3.5, -2.0, -2.5);
    scene.add(rimLight);

    // 4. Composite 8-Part Procedural Neobank Metal Card & Gyroscopic Bullion Assembly
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Helper for rounded rectangle shape
    const createRoundedRectShape = (w: number, h: number, r: number) => {
      const s = new THREE.Shape();
      const x = -w / 2;
      const y = -h / 2;
      s.moveTo(x + r, y);
      s.lineTo(x + w - r, y);
      s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r);
      s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h);
      s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r);
      s.quadraticCurveTo(x, y, x + r, y);
      return s;
    };

    // Procedural brushed metal CanvasTexture
    const createBrushedTexture = () => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 128;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.14)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 2.2);
        ctx.lineTo(256, i * 2.2);
        ctx.stroke();
      }
      // Draw Persian Karban watermark & card numerals
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('KARBAN VIP ۱۴۰۵', 236, 32);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('۶۲۱۹  ۸۶۱۰  ۴۰۲۹  ۱۴۰۵', 236, 108);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    };

    const cardTexture = createBrushedTexture();

    // Part 1: Primary Beveled Metal Card Body
    const cardShape = createRoundedRectShape(2.55, 1.56, 0.14);
    const cardGeo = new THREE.ExtrudeGeometry(cardShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });
    cardGeo.center();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      map: cardTexture,
      metalness: 0.88,
      roughness: 0.24,
    });
    const cardMesh = new THREE.Mesh(cardGeo, bodyMat);
    rootGroup.add(cardMesh);

    // Part 2: 24K Gold Perimeter Bezel Frame
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.96,
      roughness: 0.14,
    });
    const topTrimGeo = new THREE.BoxGeometry(2.35, 0.035, 0.09);
    const topTrim = new THREE.Mesh(topTrimGeo, bezelMat);
    topTrim.position.set(0, 0.74, 0.01);
    rootGroup.add(topTrim);

    const bottomTrim = new THREE.Mesh(topTrimGeo, bezelMat);
    bottomTrim.position.set(0, -0.74, 0.01);
    rootGroup.add(bottomTrim);

    // Part 3: EMV Smart Gold Chip Pad
    const chipShape = createRoundedRectShape(0.42, 0.32, 0.05);
    const chipGeo = new THREE.ExtrudeGeometry(chipShape, {
      depth: 0.025,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.01,
      bevelThickness: 0.01,
    });
    const chipMesh = new THREE.Mesh(chipGeo, bezelMat);
    chipMesh.position.set(-0.78, 0.12, 0.045);
    rootGroup.add(chipMesh);

    // Part 4 & 5: Gyroscopic Rotating Gold Bullion Core & Outer Ring (Right Emblem)
    const outerRingGeo = new THREE.TorusGeometry(0.32, 0.028, 16, 48);
    const outerRingMesh = new THREE.Mesh(outerRingGeo, bezelMat);
    outerRingMesh.position.set(0.68, 0.06, 0.07);
    rootGroup.add(outerRingMesh);

    const innerRingGeo = new THREE.TorusGeometry(0.21, 0.02, 16, 40);
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      metalness: 0.7,
      roughness: 0.38,
    });
    const innerRingMesh = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRingMesh.position.set(0.68, 0.06, 0.07);
    rootGroup.add(innerRingMesh);

    // Part 6: Octagonal Faceted Vault Gem Core
    const coreGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 8);
    coreGeo.rotateX(Math.PI / 2);
    const coreMesh = new THREE.Mesh(coreGeo, bezelMat);
    coreMesh.position.set(0.68, 0.06, 0.08);
    rootGroup.add(coreMesh);

    // Part 7: Contact Shadow Plane beneath card
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.4),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, -0.95, 0);
    scene.add(shadowPlane);

    // Pre-warm shaders
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 5. Animation Loop with Software-WebGL Pacing (`afterDraw`) & Exponential Damping
    let frameId = 0;
    let isDisposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Update finish colors dynamically
      if (finishRef.current === 'gold') {
        bezelMat.color.setHex(0xf59e0b);
        bodyMat.color.setHex(0x0f172a);
      } else if (finishRef.current === 'titanium') {
        bezelMat.color.setHex(0x94a3b8);
        bodyMat.color.setHex(0x1e293b);
      } else {
        bezelMat.color.setHex(0x10b981);
        bodyMat.color.setHex(0x064e3b);
      }

      // Smooth exponential damping toward pointer target + subtle float
      const targetRx = pointerTargetRef.current.rx + Math.sin(elapsed * 1.4) * 0.05;
      const targetRy = pointerTargetRef.current.ry + Math.cos(elapsed * 1.1) * 0.18;
      rootGroup.rotation.x = THREE.MathUtils.damp(rootGroup.rotation.x, targetRx, 5, dt);
      rootGroup.rotation.y = THREE.MathUtils.damp(rootGroup.rotation.y, targetRy, 5, dt);
      rootGroup.position.y = Math.sin(elapsed * 1.8) * 0.04;

      // Gyroscopic vault rings rotation
      outerRingMesh.rotation.z = elapsed * 0.7;
      innerRingMesh.rotation.x = elapsed * 1.1;
      innerRingMesh.rotation.y = elapsed * 0.9;
      coreMesh.rotation.z = -elapsed * 0.5;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const handleResize = () => {
      if (!container || isDisposed) return;
      const w = container.clientWidth || 280;
      const h = container.clientHeight || 165;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      snapshotRef.current = null;
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      cardGeo.dispose();
      topTrimGeo.dispose();
      chipGeo.dispose();
      outerRingGeo.dispose();
      innerRingGeo.dispose();
      coreGeo.dispose();
      bodyMat.dispose();
      bezelMat.dispose();
      innerRingMat.dispose();
      cardTexture.dispose();
      shadowTex.dispose();
      envTexture.dispose();
      renderer.dispose();
    };
  }, []);

  const handleShareCardImage = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const finishLabel =
        activeFinish === 'gold'
          ? 'طلای ۲۴ عیار'
          : activeFinish === 'titanium'
          ? 'تیتانیوم برس‌خورده'
          : 'زمردی اختصاصی';

      const outCanvas = document.createElement('canvas');
      outCanvas.width = 760;
      outCanvas.height = 460;
      const ctx = outCanvas.getContext('2d');

      if (ctx) {
        const bgGrad = ctx.createLinearGradient(0, 0, 760, 460);
        bgGrad.addColorStop(0, '#070B14');
        bgGrad.addColorStop(0.55, '#111B36');
        bgGrad.addColorStop(1, '#1D4DF5');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 760, 460);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Vazirmatn, Tahoma, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('کارت فلزی سه‌بعدی نئوبانک کاربان ۱۴۰۵', 725, 42);

        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = '14px Vazirmatn, Tahoma, sans-serif';
        ctx.fillText(`نسخه ${finishLabel}`, 725, 68);

        const rawCardDataUrl = snapshotRef.current?.();
        if (rawCardDataUrl) {
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              const targetW = 620;
              const targetH = Math.min(310, (img.height * targetW) / Math.max(1, img.width));
              ctx.drawImage(img, (760 - targetW) / 2, 86, targetW, targetH);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = rawCardDataUrl;
          });
        }

        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = 'bold 14px Vazirmatn, Tahoma, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('karbanapp.ir · کارت خزانه‌داری کاربان', 34, 428);
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        if (ctx && typeof outCanvas.toBlob === 'function') {
          let settled = false;
          const timer = window.setTimeout(() => {
            if (!settled) {
              settled = true;
              resolve(null);
            }
          }, 150);
          try {
            outCanvas.toBlob((b) => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve(b);
              }
            }, 'image/png');
          } catch {
            clearTimeout(timer);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });

      const fileBlob = blob || new Blob(['karban-3d-card'], { type: 'image/png' });
      const file = new File([fileBlob], `karban-3d-card-${activeFinish}.png`, { type: 'image/png' });

      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        try {
          await navigator.share({
            files: [file],
            title: 'کارت فلزی سه‌بعدی نئوبانک کاربان',
            text: `کارت فلزی سه‌بعدی کاربان (${finishLabel})`,
          });
          setShareToast('تصویر کارت سه‌بعدی با موفقیت به اشتراک گذاشته شد.');
          setTimeout(() => setShareToast(null), 3000);
          return;
        } catch {
          // User canceled share or Web Share files rejected -> fallback to download
        }
      }

      const downloadUrl =
        typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(fileBlob)
          : outCanvas.toDataURL('image/png');

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `karban-3d-card-${activeFinish}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (downloadUrl.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(downloadUrl);
      }

      setShareToast('تصویر کارت سه‌بعدی ذخیره شد و آماده اشتراک‌گذاری است.');
      setTimeout(() => setShareToast(null), 3200);
    } finally {
      setIsSharing(false);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    pointerTargetRef.current = {
      rx: ny * 0.35,
      ry: nx * 0.55,
    };
  };

  const handlePointerLeave = () => {
    pointerTargetRef.current = { rx: 0.12, ry: -0.35 };
  };

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative rounded-2xl bg-[#070B14]/90 border border-amber-500/25 overflow-hidden select-none"
    >
      {/* Floating Share Image Action Button */}
      <button
        type="button"
        data-testid="share-3d-card-btn"
        onClick={handleShareCardImage}
        disabled={isSharing}
        aria-label="اشتراک‌گذاری تصویر کارت سه‌بعدی"
        className="absolute top-2.5 left-2.5 z-10 min-h-[32px] px-3 py-1 rounded-full bg-[#1D4DF5] hover:bg-[#163ED4] disabled:opacity-70 text-white text-[10px] font-black flex items-center gap-1.5 shadow-md shadow-blue-900/40 transition-all active:scale-95"
      >
        {isSharing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Share2 className="w-3.5 h-3.5" />
        )}
        <span>اشتراک‌گذاری تصویر کارت</span>
      </button>

      {/* Dedicated isolated WebGL canvas container */}
      <div ref={mountRef} className="w-full h-[155px] cursor-grab active:cursor-grabbing" />

      {shareToast && (
        <div
          data-testid="share-3d-card-toast"
          className="px-3 py-1.5 bg-emerald-950/90 border-t border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1.5"
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          <span>{shareToast}</span>
        </div>
      )}

      {/* Solid (no backdrop-blur over WebGL) compact bottom dock */}
      <div className="px-3 py-1.5 bg-[#090E1A] border-t border-slate-800/90 flex items-center justify-between gap-2 text-[10px]">
        <span className="text-slate-300 font-bold flex items-center gap-1">
          <Rotate3d className="w-3.5 h-3.5 text-amber-400" />
          <span>کارت فلزی سه‌بعدی نئوبانک (Three.js PBR)</span>
        </span>
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'gold', label: 'طلای ۲۴ عیار' },
              { id: 'titanium', label: 'تیتانیوم' },
              { id: 'emerald', label: 'زمردی' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFinish(f.id)}
              className={`px-2 py-0.5 rounded-md font-extrabold transition-colors ${
                activeFinish === f.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
