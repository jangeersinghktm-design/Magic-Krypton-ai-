// types/pdf-parse.d.ts
// pdf-parse ships no TypeScript types of its own. This minimal declaration
// covers exactly what app/api/attachments/extract/route.ts actually uses.
declare module "pdf-parse" {
  interface PDFParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, any>;
    metadata: any;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer, options?: any): Promise<PDFParseResult>;
  export default pdfParse;
}

