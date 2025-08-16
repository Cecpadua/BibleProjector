// 简化的测试版本
let canvas = null
let ctx = null

console.log('Test projector loading...')

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing...')
  
  canvas = document.getElementById('projectorCanvas')
  if (!canvas) {
    console.error('Canvas element not found!')
    return
  }
  
  ctx = canvas.getContext('2d')
  console.log('Canvas found and context created')
  
  // 简单的初始化
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  
  ctx.scale(dpr, dpr)
  
  // 简单渲染
  ctx.fillStyle = '#ffffff'
  ctx.font = '24px Arial'
  ctx.fillText('测试：投影窗口工作正常', 50, 100)
  
  console.log('Test rendering completed')
})
