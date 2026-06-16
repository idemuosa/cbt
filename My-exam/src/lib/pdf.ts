import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export const generateResultPDF = async (data: {
  studentName: string,
  examNumber: string,
  examTitle: string,
  score: number,
  totalQuestions: number,
  percentage: number,
  date: string,
  attemptId: string,
  organizationName?: string,
  logoUrl?: string
}) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Branding Colors
  const primaryColor = [17, 24, 39]; // Default Dark
  const accentColor = [59, 130, 246]; // Default Blue

  // Header Background
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 40, 'F');

  // Organization Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(data.organizationName || 'EduTest Unified Portal', 20, 25);

  // subtitle
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL EXAMINATION STATEMENT OF RESULT', 20, 32);

  // Content Body
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  
  // Student Info Box
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(20, 50, 170, 30, 3, 3, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.text('CANDIDATE INFORMATION', 25, 58);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${data.studentName}`, 25, 66);
  doc.text(`Exam Number: ${data.examNumber}`, 25, 73);

  // Exam Details
  doc.setFont('helvetica', 'bold');
  doc.text('ASSESSMENT DETAILS', 20, 100);
  doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.line(20, 102, 190, 102);

  doc.setFont('helvetica', 'normal');
  doc.text(`Assessment Title:`, 20, 110);
  doc.text(data.examTitle, 80, 110);
  
  doc.text(`Completion Date:`, 20, 118);
  doc.text(data.date, 80, 118);

  // Score Visualization
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(60, 140, 90, 40, 5, 5, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.text(`${data.percentage.toFixed(1)}%`, 105, 165, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`${data.score} / ${data.totalQuestions} CORRECT`, 105, 175, { align: 'center' });

  // QR Code for Verification
  const qrUrl = `https://edutest-cbt.vercel.app/verify/${data.attemptId}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl);
  doc.addImage(qrDataUrl, 'PNG', 150, 240, 40, 40);

  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text('SCAN TO VERIFY AUTHENTICITY', 170, 285, { align: 'center' });
  doc.text(`SECURE_ID: ${data.attemptId.toUpperCase()}`, 20, 285);

  // Footer
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 270, 190, 270);
  doc.text('This is a computer-generated result and does not require a physical signature.', 105, 278, { align: 'center' });

  doc.save(`Result_${data.examNumber}_${data.examTitle.replace(/\s+/g, '_')}.pdf`);
};
