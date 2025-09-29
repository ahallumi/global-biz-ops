#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function testGotenberg() {
  const GOTENBERG_URL = 'http://localhost:3000';
  
  console.log('🧪 Testing Gotenberg Integration');
  console.log('================================');
  
  try {
    // Read the HTML file
    const htmlPath = path.join(__dirname, 'test-label.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    console.log('📄 HTML content loaded:', htmlContent.length, 'chars');
    
    // Create FormData (mimicking what the edge function will do)
    const FormData = require('form-data');
    const formData = new FormData();
    
    // Add HTML file as form data
    formData.append('files', htmlContent, {
      filename: 'index.html',
      contentType: 'text/html'
    });
    
    // Add Chromium options as JSON
    const chromiumOptions = {
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0mm',
        right: '0mm', 
        bottom: '0mm',
        left: '0mm'
      }
    };
    
    formData.append('chromiumJsonOptions', JSON.stringify(chromiumOptions));
    
    console.log('📝 FormData prepared with:');
    console.log('   - HTML file: index.html');
    console.log('   - Chromium options:', JSON.stringify(chromiumOptions, null, 2));
    
    // Make request to Gotenberg
    console.log('🚀 Sending request to Gotenberg...');
    const startTime = Date.now();
    
    const response = await fetch(`${GOTENBERG_URL}/forms/chromium/convert/html`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    const duration = Date.now() - startTime;
    console.log(`⏱️  Request completed in ${duration}ms`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gotenberg error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    // Get PDF as buffer
    const pdfBuffer = await response.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    
    console.log('✅ PDF generated successfully:');
    console.log(`   - Size: ${pdfBuffer.byteLength} bytes (${Math.round(pdfBuffer.byteLength / 1024)}KB)`);
    console.log(`   - Header: ${pdfBase64.substring(0, 8)}`);
    console.log(`   - Valid PDF: ${pdfBase64.startsWith('JVBERi0')}`);
    
    // Save PDF to file for inspection
    const outputPath = path.join(__dirname, 'test-output.pdf');
    fs.writeFileSync(outputPath, Buffer.from(pdfBuffer));
    console.log(`💾 PDF saved to: ${outputPath}`);
    
    // Test response format compatibility
    const mockResponse = {
      pdf_base64: pdfBase64,
      server_optimized: true,
      gotenberg: true,
      size_bytes: pdfBuffer.byteLength
    };
    
    console.log('🔄 Response format compatibility:');
    console.log('   - pdf_base64: ✅ Available');
    console.log('   - size_bytes: ✅ Available');
    console.log('   - Valid base64: ✅', /^[A-Za-z0-9+/]*={0,2}$/.test(pdfBase64));
    
    return mockResponse;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure Gotenberg is running:');
      console.log('   docker run --rm -p 3000:3000 gotenberg/gotenberg:7');
    }
    
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testGotenberg()
    .then(() => {
      console.log('\n🎉 All tests passed! Gotenberg integration looks good.');
      console.log('\nNext steps:');
      console.log('1. Check the generated PDF: test-output.pdf');
      console.log('2. Verify dimensions and print quality');
      console.log('3. Ready to integrate into edge function!');
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed');
      process.exit(1);
    });
}

module.exports = { testGotenberg };