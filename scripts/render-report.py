"""Produce paginated WIST report cards from validated JSON; stdout is PDF bytes."""
import io, json, os, sys, html
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import letter
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader, PdfWriter
ROOT = Path(__file__).resolve().parent.parent
BLUE=colors.HexColor('#22477f'); LIGHT=colors.HexColor('#d7dfeb'); LINE=colors.HexColor('#c9cdd2'); INK=colors.HexColor('#30353b')
font_dir=Path(os.environ.get('WINDIR','C:/Windows'))/'Fonts'
if (font_dir/'arial.ttf').exists():
    for name,file in [('Body','arial.ttf'),('BodyBold','arialbd.ttf'),('BodyItalic','ariali.ttf')]: pdfmetrics.registerFont(TTFont(name,str(font_dir/file)))
else:
    for name,font in [('Body','Helvetica'),('BodyBold','Helvetica-Bold'),('BodyItalic','Helvetica-Oblique')]: pdfmetrics.registerFontFamily(name,normal=font,bold=font)
    # Built-in names keep the renderer usable when custom fonts are unavailable.
    from reportlab.pdfbase.pdfmetrics import Font
    for name,font in [('Body','Helvetica'),('BodyBold','Helvetica-Bold'),('BodyItalic','Helvetica-Oblique')]: pdfmetrics.registerFont(Font(name,font,'WinAnsiEncoding'))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='BodyBold',italic='BodyItalic',boldItalic='BodyBold')
styles={
 'body':ParagraphStyle('body',fontName='Body',fontSize=10.5,leading=14,textColor=INK,spaceAfter=0),
 'small':ParagraphStyle('small',fontName='Body',fontSize=8,leading=10,textColor=colors.HexColor('#69717a')),
 'heading':ParagraphStyle('heading',fontName='BodyBold',fontSize=10,leading=13,textColor=BLUE,spaceBefore=15,spaceAfter=8),
 'teacher':ParagraphStyle('teacher',fontName='Body',fontSize=7.5,leading=10,textColor=colors.HexColor('#73777d')),
 'class':ParagraphStyle('class',fontName='BodyBold',fontSize=9.5,leading=13,textColor=INK),
 'tablehead':ParagraphStyle('tablehead',fontName='BodyBold',fontSize=8,leading=11,textColor=INK),
 'grade':ParagraphStyle('grade',fontName='BodyBold',fontSize=11,leading=14,textColor=INK,alignment=1),
 'keyhead':ParagraphStyle('keyhead',fontName='BodyBold',fontSize=12,leading=17,textColor=colors.white,spaceAfter=9),
 'key':ParagraphStyle('key',fontName='Body',fontSize=9.2,leading=12.5,textColor=colors.white,spaceAfter=6),
 'note':ParagraphStyle('note',fontName='BodyItalic',fontSize=8,leading=11,textColor=colors.HexColor('#777e87')),
}
def para(text,style='body'):
    return Paragraph(html.escape(str(text or '')).replace('\n','<br/>'),styles[style])
def paragraphs(text,style='body'):
    return [para(part,style) for part in str(text or '').split('\n\n') if part.strip()]
def make_pdf(report):
    stream=io.BytesIO(); student=report['student']; cycle=report['cycle']; brand=report['brand']; issued=report.get('status')=='issued'
    doc=BaseDocTemplate(stream,pagesize=letter,leftMargin=46,rightMargin=46,topMargin=152,bottomMargin=46,title=f"{student['name']} - {cycle['title']}",author=brand['name'],pageCompression=1)
    width=520
    def header(canvas,doc):
        canvas.saveState(); page_w,page_h=letter
        logo=ROOT/'dist/assets/wist-report-logo.png'
        canvas.drawImage(str(logo),36,page_h-78,width=158,height=34,preserveAspectRatio=True,mask='auto')
        address_style=ParagraphStyle('address',fontName='Body',fontSize=7.4,leading=10,textColor=colors.black)
        address=Paragraph('<b>'+html.escape(brand['name'])+'</b><br/>'+html.escape(brand['address'])+'<br/><i>'+html.escape(brand['website'])+'</i>',address_style)
        _,height=address.wrap(142,100);address.drawOn(canvas,204,page_h-44-height)
        canvas.setFillColor(BLUE);canvas.rect(353,page_h-101,223,65,fill=1,stroke=0)
        name_style=ParagraphStyle('name',fontName='BodyBold',fontSize=12.5,leading=15,textColor=colors.white)
        name=Paragraph(html.escape(student['name'].upper()),name_style);_,nh=name.wrap(164,50)
        while nh>30 and name_style.fontSize>8:
            name_style.fontSize-=.5;name_style.leading=name_style.fontSize*1.2;name=Paragraph(html.escape(student['name'].upper()),name_style);_,nh=name.wrap(164,50)
        name.drawOn(canvas,365,page_h-52-nh)
        canvas.setFont('Body',9);canvas.setFillColor(colors.white);canvas.drawString(365,page_h-90,f"{student['yearLabel']} - {student['form']}")
        canvas.setFillColor(LIGHT);canvas.circle(552,page_h-66,17,fill=1,stroke=0);canvas.setFont('BodyBold',10);canvas.setFillColor(BLUE);canvas.drawCentredString(552,page_h-70,''.join(p[0] for p in student['name'].split()[:2]))
        title_style=ParagraphStyle('title',fontName='Body',fontSize=10,leading=13,textColor=INK)
        title=Paragraph(html.escape(cycle['academicYear']+' '+cycle['title'].upper()),title_style);_,th=title.wrap(223,50);title.drawOn(canvas,353,page_h-112-th)
        if not issued:
            canvas.setFillColor(colors.HexColor('#a06d3b'));canvas.setFont('BodyBold',7);canvas.drawString(353,644,'DRAFT - NOT ISSUED')
        canvas.setStrokeColor(LINE);canvas.setLineWidth(.5);canvas.line(46,38,566,38)
        canvas.setFont('Body',7);canvas.setFillColor(colors.HexColor('#7b838b'));canvas.drawString(46,25,('Prototype sample - fictional pupil data' if student.get('synthetic') else brand['name']))
        canvas.drawRightString(566,25,f"Page {doc.page}"+(f" - Issued v{report['issue']['version']}" if issued else ' - Draft preview'))
        if not issued:
            canvas.saveState();canvas.translate(306,370);canvas.rotate(35);canvas.setFillColor(colors.HexColor('#e5e8ed'));canvas.setFont('BodyBold',46);canvas.drawCentredString(0,0,'DRAFT - NOT ISSUED');canvas.restoreState()
        canvas.restoreState()
    doc.addPageTemplates([PageTemplate(id='Report',frames=[Frame(46,46,520,594,id='main',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=header)])
    story=[]
    story.append(para('HOMEROOM COMMENTS','heading'))
    comment=report['homeroom'].get('comment') or 'Homeroom comment not yet completed.'
    # Split long comments naturally across pages instead of clipping a fixed-height box.
    comment_blocks=[]
    for index,p in enumerate(paragraphs(comment)):
        if index:comment_blocks.append(Spacer(1,9))
        comment_blocks.append(p)
    table=Table([[comment_blocks]],colWidths=[520],hAlign='LEFT',splitByRow=1,splitInRow=1)
    table.setStyle(TableStyle([('BOX',(0,0),(-1,-1),.5,LINE),('BACKGROUND',(0,0),(-1,-1),colors.white),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]));story.append(table)
    story.append(Spacer(1,6));story.append(para('Form tutor: '+report['homeroom']['teacher'],'small'))
    attendance=report['attendance'];story.append(para('ATTENDANCE','heading'))
    absence=attendance.get('absentDays');attendance_table=Table([[para('ABSENT','tablehead'),para(cycle['term'],'tablehead')],[para('Recorded dates with an absence mark','small'),para('Not recorded' if absence is None else str(absence),'grade')]],colWidths=[230,80],hAlign='LEFT')
    attendance_table.setStyle(TableStyle([('BOX',(0,0),(-1,-1),.5,LINE),('INNERGRID',(0,0),(-1,-1),.4,LINE),('BACKGROUND',(1,1),(1,1),LIGHT),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]));story.append(attendance_table)
    story.append(Spacer(1,4));story.append(para(attendance['note'],'note'));story.append(Spacer(1,14))
    headings=[para('CLASSES / TEACHER','tablehead'),para('EFFORT','tablehead'),para('ATTAINMENT','tablehead'),para(cycle['term'],'tablehead')]
    table_data=[headings]
    for row in report['rows']:
        cell=[para(row['className'] if row['subject'] in row['className'] else row['subject']+' - '+student['groupName'],'class'),para(row['teacher'],'teacher')]
        if row.get('comment'):cell.append(Spacer(1,4));cell.extend(paragraphs(row['comment'],'small'))
        table_data.append([cell,para(row.get('effort') or '-','grade'),para(row.get('grade') or '-','grade'),''])
    grades=Table(table_data,colWidths=[310,65,100,45],repeatRows=1,hAlign='LEFT',splitByRow=1,splitInRow=1)
    grades.setStyle(TableStyle([('GRID',(0,1),(-1,-1),.6,LINE),('LINEBELOW',(0,0),(-1,0),1,LINE),('BACKGROUND',(3,1),(3,-1),LIGHT),('BACKGROUND',(0,1),(2,-1),colors.white),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,0),9),('BOTTOMPADDING',(0,0),(-1,0),9),('TOPPADDING',(0,1),(-1,-1),9),('BOTTOMPADDING',(0,1),(-1,-1),9)]));story.append(grades)
    story.append(PageBreak());story.append(para('KEY OF OUR GRADES','heading'))
    key_body=[para('Effort Grades','keyhead')]+[para(text,'key') for text in report['effortKey']]+[Spacer(1,8),para('Attainment Grades','keyhead')]+[para(text,'key') for text in report['attainmentKey']]
    # A one-cell split-capable table preserves the blue key panel across page breaks.
    key_table=Table([[key_body]],colWidths=[520],splitByRow=1,splitInRow=1)
    key_table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),BLUE),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),12),('BOTTOMPADDING',(0,0),(-1,-1),12)]));story.append(key_table)
    signoff=[Spacer(1,22),para(brand['signOffRole'].upper(),'heading'),para(('Reviewed and issued by '+report['issue']['issuedBy'] if issued else 'Review and issue pending.'),'small'),Spacer(1,24),para('Signature: _____________________________________','small'),Spacer(1,6),para('No signature image is attached to this prototype report.','note')]
    story.append(KeepTogether(signoff));doc.build(story)
    return stream.getvalue()
def main():
    sys.stdin.reconfigure(encoding='utf-8');data=json.load(sys.stdin);reports=data.get('reports') or [data]
    if len(reports)==1:output=make_pdf(reports[0])
    else:
        writer=PdfWriter()
        for report in reports:writer.append(PdfReader(io.BytesIO(make_pdf(report))))
        stream=io.BytesIO();writer.write(stream);output=stream.getvalue()
    sys.stdout.buffer.write(output)
if __name__=='__main__':
    try:main()
    except Exception as exc:
        sys.stderr.write(str(exc));sys.exit(1)
