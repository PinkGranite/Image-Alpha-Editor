import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import './ImageEditor.css';

// Add this type definition
type Point = { x: number; y: number };

interface SelectedArea {
  path: fabric.Path;
  points: Point[];
  bounds: fabric.IBoundingRect;
  originalImageData?: ImageData;  // 存储原始区域的图像数据
}

const ImageEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [opacity, setOpacity] = useState<number>(1);
  const [isLassoMode, setIsLassoMode] = useState<boolean>(false);
  const [selectedArea, setSelectedArea] = useState<SelectedArea | null>(null);
  const pathRef = useRef<fabric.Path | null>(null);
  const pointsRef = useRef<Point[]>([]);

  const CANVAS_WIDTH = 800; // 固定画布宽度

  // Initialize canvas
  useEffect(() => {
    if (canvasRef.current) {
      const fabricCanvas = new fabric.Canvas(canvasRef.current, {
        width: CANVAS_WIDTH,
        height: CANVAS_WIDTH,
        backgroundColor: '#f0f0f0',
        selection: false,
        isDrawingMode: false,
      });

      fabricCanvas.set({
        allowTouchScrolling: false,
      });

      setCanvas(fabricCanvas);

      return () => {
        fabricCanvas.dispose();
      };
    }
  }, []);

  // Handle events based on lasso mode
  useEffect(() => {
    if (!canvas) return;

    const handleCanvasMouseDown = (e: fabric.IEvent) => {
      if (isLassoMode) {
        handleMouseDown(e);
      }
    };

    const handleCanvasMouseMove = (e: fabric.IEvent) => {
      if (isLassoMode) {
        handleMouseMove(e);
      }
    };

    const handleCanvasMouseUp = (e: fabric.IEvent) => {
      if (isLassoMode) {
        handleMouseUp();
      }
    };

    canvas.on('mouse:down', handleCanvasMouseDown);
    canvas.on('mouse:move', handleCanvasMouseMove);
    canvas.on('mouse:up', handleCanvasMouseUp);

    return () => {
      canvas.off('mouse:down', handleCanvasMouseDown);
      canvas.off('mouse:move', handleCanvasMouseMove);
      canvas.off('mouse:up', handleCanvasMouseUp);
    };
  }, [canvas, isLassoMode]);

  const handleMouseDown = (event: fabric.IEvent) => {
    if (!isLassoMode || !canvas) return;

    const pointer = canvas.getPointer(event.e);
    pointsRef.current = [{ x: pointer.x, y: pointer.y }];

    pathRef.current = new fabric.Path(`M ${pointer.x} ${pointer.y}`, {
      strokeWidth: 2,
      stroke: '#00ff00',
      fill: 'transparent',
      selectable: false,
      evented: false,
      objectCaching: false,
      perPixelTargetFind: true
    });

    canvas.add(pathRef.current);
    canvas.renderAll();
  };

  const handleMouseMove = (event: fabric.IEvent) => {
    if (!isLassoMode || !canvas || !pathRef.current) return;

    const pointer = canvas.getPointer(event.e);
    pointsRef.current.push({ x: pointer.x, y: pointer.y });

    // 更新路径
    const points = pointsRef.current;
    let pathString = `M ${points[0].x} ${points[0].y}`;
    points.slice(1).forEach(point => {
      pathString += ` L ${point.x} ${point.y}`;
    });

    pathRef.current.set({
      path: fabric.util.makePathSimpler(fabric.util.parsePath(pathString)),
      strokeWidth: 2,
      stroke: '#00ff00',
      fill: 'transparent',
      selectable: false,
      evented: false,
      objectCaching: false,
      perPixelTargetFind: true
    });
    
    // 确保路径在最顶层
    canvas.setActiveObject(pathRef.current);
    pathRef.current.bringToFront();
    canvas.requestRenderAll();
  };

  const handleMouseUp = () => {
    if (!isLassoMode || !canvas || !pathRef.current || pointsRef.current.length < 3) {
      return;
    }

    // 在松开鼠标时闭合路径
    const points = pointsRef.current;
    let pathString = `M ${points[0].x} ${points[0].y}`;
    points.slice(1).forEach(point => {
      pathString += ` L ${point.x} ${point.y}`;
    });
    pathString += ' Z'; // 闭合路径

    pathRef.current.set({ 
      path: fabric.util.makePathSimpler(fabric.util.parsePath(pathString)),
      selectable: false,
      evented: false
    });

    // 获取原始图像数据
    const image = canvas.getObjects().find(obj => obj instanceof fabric.Image) as fabric.Image;
    if (image) {
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        tempCanvas.width = image.width! * image.scaleX!;
        tempCanvas.height = image.height! * image.scaleY!;
        ctx.drawImage(image.getElement(), 0, 0, tempCanvas.width, tempCanvas.height);
        
        // 存储选区的原始图像数据
        const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        setSelectedArea({
          path: pathRef.current,
          points: pointsRef.current,
          bounds: pathRef.current.getBoundingRect(),
          originalImageData: imageData
        });
      }
    }

    canvas.renderAll();
    pathRef.current = null;
    pointsRef.current = [];
    setIsLassoMode(false);
    canvas.defaultCursor = 'default';
  };

  const handleOpacityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = parseFloat(event.target.value);
    setOpacity(newOpacity);
  };

  const handleOpacityChangeComplete = () => {
    if (!canvas || !selectedArea || !selectedArea.originalImageData) return;

    try {
      const objects = canvas.getObjects();
      const image = objects.find(obj => obj instanceof fabric.Image) as fabric.Image;
      if (!image) return;

      // 获取图片的实际尺寸和位置
      const imgElement = image.getElement() as HTMLImageElement;
      const naturalWidth = imgElement.naturalWidth;
      const naturalHeight = imgElement.naturalHeight;

      // 创建临时画布
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = naturalWidth;
      tempCanvas.height = naturalHeight;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      // 绘制原始图像
      ctx.drawImage(imgElement, 0, 0, naturalWidth, naturalHeight);

      // 获取图像数据
      const fullImageData = ctx.getImageData(0, 0, naturalWidth, naturalHeight);

      // 创建选区路径
      const path = new Path2D();
      const scaleX = naturalWidth / (image.width! * image.scaleX!);
      const scaleY = naturalHeight / (image.height! * image.scaleY!);
      
      selectedArea.points.forEach((point, index) => {
        const scaledX = point.x * scaleX;
        const scaledY = point.y * scaleY;
        if (index === 0) {
          path.moveTo(scaledX, scaledY);
        } else {
          path.lineTo(scaledX, scaledY);
        }
      });
      path.closePath();

      // 创建新的画布用于选区
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = naturalWidth;
      maskCanvas.height = naturalHeight;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) return;

      // 绘制选区
      maskCtx.fillStyle = 'black';
      maskCtx.fill(path);

      // 获取选区的像素数据
      const maskData = maskCtx.getImageData(0, 0, naturalWidth, naturalHeight);

      // 应用透明度
      for (let i = 0; i < fullImageData.data.length; i += 4) {
        if (maskData.data[i + 3] > 0) {
          fullImageData.data[i + 3] = Math.round(fullImageData.data[i + 3] * opacity);
        }
      }

      // 将处理后的图像数据绘制回临时画布
      ctx.putImageData(fullImageData, 0, 0);

      // 更新画布上的图片
      fabric.Image.fromURL(tempCanvas.toDataURL(), (newImg) => {
        newImg.set({
          left: image.left,
          top: image.top,
          scaleX: image.scaleX,
          scaleY: image.scaleY,
          selectable: false,
          evented: false
        });

        canvas.remove(image);
        canvas.add(newImg);
        
        // 确保选区路径在最上层
        if (selectedArea.path) {
          selectedArea.path.set({
            absolutePositioned: true,
            selectable: false,
            evented: false
          });
          canvas.bringToFront(selectedArea.path);
        }
        
        canvas.renderAll();
      });
    } catch (error) {
      console.error('Error updating opacity:', error);
    }
  };

  const handleSave = () => {
    if (!canvas || !imageFile) return;

    // 移除选区显示
    const objects = canvas.getObjects();
    const pathObjects = objects.filter(obj => obj instanceof fabric.Path);
    pathObjects.forEach(obj => canvas.remove(obj));

    // 保存图片
    const link = document.createElement('a');
    link.download = `edited_${imageFile.name}`;
    link.href = canvas.toDataURL({
      format: 'png',
      quality: 1
    });

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 恢复选区显示
    if (selectedArea) {
      const border = new fabric.Path(selectedArea.path.path as string[], {
        fill: 'transparent',
        stroke: '#00ff00',
        strokeWidth: 2,
        absolutePositioned: true
      });
      canvas.add(border);
      canvas.renderAll();
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !canvas) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      fabric.Image.fromURL(dataUrl, (img) => {
        if (!canvas) return;

        canvas.clear();
        
        // 计算图片缩放比例，保持宽度为画布宽度
        const scale = canvas.width! / img.width!;
        const newHeight = img.height! * scale;
        
        // 调整画布高度以适应图片
        canvas.setHeight(newHeight);
        
        img.set({
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
        });

        img.center();
        canvas.add(img);
        canvas.renderAll();
        
        setImageFile(file);
        setSelectedArea(null);
        setOpacity(1);
      });
    };

    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    if (canvas) {
      canvas.clear();
      canvas.backgroundColor = '#f0f0f0';
      canvas.setHeight(CANVAS_WIDTH); // 重置画布高度为初始值
      canvas.renderAll();
      setImageFile(null);
      setSelectedArea(null);
      setOpacity(1);
      
      // 重置文件输入框
      const fileInput = document.querySelector('.file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }
  };

  const toggleLassoMode = () => {
    console.log('Toggling lasso mode', { currentMode: isLassoMode });
    setIsLassoMode(!isLassoMode);
    if (canvas) {
      canvas.defaultCursor = !isLassoMode ? 'crosshair' : 'default';
      // Reset any existing path when toggling mode
      if (pathRef.current) {
        canvas.remove(pathRef.current);
        pathRef.current = null;
      }
      pointsRef.current = [];
      canvas.renderAll();
    }
  };

  const clearSelection = () => {
    if (selectedArea && canvas) {
      // 移除选区路径
      canvas.remove(selectedArea.path);
      
      // 重置选区和透明度
      setSelectedArea(null);
      setOpacity(1);
      canvas.renderAll();
    }
  };

  return (
    <div className="image-editor-container">
      <div className="editor-header">
        <h1>Image Editor</h1>
        <p>Upload an image and use the lasso tool to select areas for opacity adjustment</p>
      </div>
      
      <div className="canvas-container">
        <div className={`canvas-wrapper ${isLassoMode ? 'lasso-mode' : ''}`}>
          <canvas ref={canvasRef} />
          {isLassoMode && (
            <div className="mode-indicator">Lasso Mode Active</div>
          )}
        </div>
      </div>

      <div className="controls">
        <label className="file-input-label">
          Upload Image
          <input
            type="file"
            className="file-input"
            accept="image/*"
            onChange={handleImageUpload}
          />
        </label>
        
        <button 
          className={`button ${isLassoMode ? 'active' : ''}`} 
          onClick={toggleLassoMode}
          disabled={!imageFile}
        >
          {isLassoMode ? 'Exit Lasso Mode' : 'Lasso Tool'}
        </button>

        {selectedArea && (
          <button 
            className="button secondary"
            onClick={clearSelection}
          >
            Clear Selection
          </button>
        )}
        
        <div className="opacity-control">
          <label>
            Opacity: {(opacity * 100).toFixed(0)}%
            {selectedArea && ' (Selected Area)'}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={opacity}
            onChange={handleOpacityChange}
            onMouseUp={handleOpacityChangeComplete}  // 添加这个事件处理
            onTouchEnd={handleOpacityChangeComplete} // 添加触摸设备支持
            disabled={!selectedArea}
            style={{ width: '200px' }}
          />
        </div>

        <button 
          className="button" 
          onClick={handleSave} 
          disabled={!imageFile}
        >
          Save Image
        </button>
        
        <button 
          className="button secondary" 
          onClick={handleClear}
        >
          Clear Canvas
        </button>
      </div>
    </div>
  );
};

export default ImageEditor;
