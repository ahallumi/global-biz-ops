-- Update the HTML template to use SVG barcodes instead of font-based barcodes
UPDATE label_templates 
SET html_template = '<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Label 62×28.9 — SVG Barcode</title>

<!-- Embedded WOFF2 fonts for server-side rendering -->
<style>
  @font-face { 
    font-family: "Inter"; 
    src: url("data:font/woff2;base64,d09GMgABAAAAAAb8AAoAAAAAD...") format("woff2"); 
    font-weight: 400 800; 
    font-display: swap;
  }
</style>

<!-- Fallback: load from Google Fonts if embedded fails -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;800&display=swap" rel="stylesheet">

<style>
  @page { size: 62mm 28.9mm; margin: 0; }
  html, body { width:62mm; height:28.9mm; margin:0; padding:0; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family: "Inter", system-ui, sans-serif; }

  .label   { position:relative; width:62mm; height:28.9mm; }
  .content { position:absolute; left:1mm; top:1mm; width:60mm; height:26.9mm; overflow:hidden; }

  .top    { position:absolute; left:0; top:0; width:60mm; height:14mm; }
  .left   { position:absolute; left:0; top:0; width:40mm; height:14mm; padding-right:1mm; }
  .right  { position:absolute; right:0; top:0; width:20mm; height:14mm; text-align:right; z-index:5; }

  .name   { position:absolute; left:0; top:0; width:40mm; height:10.5mm; font-weight:800; line-height:1.15; overflow:hidden; z-index:10; }
  .name::after { content:""; position:absolute; left:0; right:0; bottom:-0.4mm; height:0.4mm; }
  .sku    { position:absolute; left:0; bottom:0; width:40mm; height:3.2mm; font-size:5.5pt; opacity:.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  .price  { position:absolute; right:0; top:0; width:20mm; height:8mm; font-weight:800; white-space:nowrap; }
  .unit   { position:absolute; right:0; top:8.4mm; width:20mm; height:4.6mm; font-size:6.5pt; opacity:.9; white-space:nowrap; }

  /* SVG barcode positioning - precise and device-agnostic */
  .barcode-wrap { position:absolute; left:0; bottom:0; width:60mm; height:12mm; }
  .barcode      { position:absolute; left:0; top:0; width:60mm; height:12mm; }
  .barcode svg  { width:100%; height:100%; display:block; shape-rendering:crispEdges; }

  .autofit { overflow:hidden; }
</style>
</head>
<body>
  <div class="label">
    <div class="content">
      <div class="top">
        <div class="left">
          <div class="name autofit" data-minpt="7" data-maxpt="10">{{product.name}}</div>
          <div class="sku">{{product.sku}}</div>
        </div>
        <div class="right">
          <div class="price">{{price_formatted}}</div>
          <div class="unit">{{unit_suffix}}</div>
        </div>
      </div>

      <div class="barcode-wrap">
        <!-- SVG barcode with proper dot-grid precision for 300 DPI printing -->
        <div class="barcode">{{barcode_svg}}</div>
      </div>
    </div>
  </div>

  <script>
  (function(){
    const PT_PER_DOT = 72/300;                  // 0.24 pt per printer dot at 300 DPI
    const snapPt = pt => Math.round(pt/PT_PER_DOT)*PT_PER_DOT;  // snap to dot grid
    function fits(el){ const r=el.getBoundingClientRect(); return el.scrollWidth<=r.width+0.5 && el.scrollHeight<=r.height+0.5; }
    document.querySelectorAll(''.autofit'').forEach(el=>{
      const min=+el.dataset.minpt||7, max=+el.dataset.maxpt||10;
      let lo=min, hi=max, best=min;
      for(let i=0;i<7;i++){ const mid=(lo+hi)/2; el.style.fontSize=snapPt(mid)+''pt''; fits(el)?(best=mid,lo=mid):(hi=mid); }
      el.style.fontSize=snapPt(best)+''pt'';
    });
  })();
  </script>
</body>
</html>'
WHERE profile_id = '1759027362877' AND is_active = true;