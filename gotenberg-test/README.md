# Gotenberg Local Test

This directory contains a local test setup for validating Gotenberg PDF generation before integrating into the edge function.

## Quick Start

1. **Start Gotenberg locally:**
   ```bash
   docker run --rm -p 3000:3000 gotenberg/gotenberg:7
   ```

2. **Install dependencies and run test:**
   ```bash
   cd gotenberg-test
   npm install
   npm test
   ```

## What This Tests

### HTML Template Structure
- **Dimensions**: 62mm × 28.9mm (same as your current labels)
- **CSS @page**: Proper page sizing for PDF generation
- **Content**: Product name, price, barcode, SKU, timestamp
- **Diagnostic mode**: Border and outline styles for print verification

### FormData Integration
- **HTML file attachment**: Mimics edge function FormData structure
- **Chromium options**: Tests printBackground, preferCSSPageSize, margins
- **Response format**: Validates PDF base64 encoding and size

### Output Validation
- **PDF header verification**: Checks for valid PDF signature (`JVBERi0`)
- **File size reporting**: Compares with current Browserless output (~23KB)
- **Response compatibility**: Ensures same format as existing edge function

## Expected Results

✅ **Success indicators:**
- PDF generated in ~200-500ms
- File size: 15-30KB (similar to Browserless)
- Valid PDF header: `JVBERi0x`
- Clean test-output.pdf file created

❌ **Common issues:**
- Connection refused → Gotenberg not running on port 3000
- Invalid PDF → CSS @page syntax issues
- Large file size → Image/font embedding problems

## Files Generated

- `test-output.pdf` - The generated PDF for visual inspection
- Check dimensions, text clarity, barcode readability

## Next Steps

Once this test passes:
1. **Visual inspection**: Open test-output.pdf and verify quality
2. **Print test**: Print the PDF and measure actual dimensions
3. **Edge function integration**: Update render-label-pdf function
4. **Production deployment**: Set up production Gotenberg server

## Integration Notes

The test uses the same FormData structure that will be implemented in the edge function:
- HTML file as `files` form field
- Chromium options as `chromiumJsonOptions` JSON string
- Response format matches existing Browserless integration