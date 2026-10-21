import PDFDocument from 'pdfkit';
import { supabase } from '../config/supabaseClient.js';


const TIME_ZONE = 'America/Santiago';
const DESCRIPTION_MAX = 300;

const TROPHY_TYPE_LABELS = { 0: 'Bronce', 1: 'Plata', 2: 'Oro' };
const BADGE_TYPE_LABELS = { 0: 'Común', 1: 'Rara', 2: 'Épica', 3: 'Única' };

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = { left: 57, right: 57, top: 51, bottom: 43 };
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;
const FOOTER_HEIGHT = 24;

const FONTS = {
    serif: 'Times-Roman',
    serifBold: 'Times-Bold',
    serifItalic: 'Times-Italic',
    sans: 'Helvetica',
    sansBold: 'Helvetica-Bold',
    mono: 'Courier',
};

const COLORS = {
    text: '#111111',
    muted: '#444444',
    label: '#333333',
    border: '#bbbbbb',
    borderDark: '#999999',
    labelBg: '#f4f4f4',
    headerBg: '#e9e9e9',
};

function httpError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
}

// se reune todo lo que necesita el reporte
export async function getSessionReportData(sessionid) {
    const id = Number(sessionid);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'ID de sesión inválido');

    const { data: session, error: sessionError } = await supabase
        .from('session')
        .select('sessionid, userid, labid, iscompleted, issolved, starttime, finishtime, failedflags, restartcount, capturedflag, users(username, firstname, lastname), lab(title, description, flag)')
        .eq('sessionid', id)
        .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) throw httpError(404, 'Sesión no encontrada');
    if (!session.iscompleted) throw httpError(409, 'El reporte estará disponible cuando la sesión termine');

    // trofeos e insignias ganados en la sesion
    const [trophyResult, badgeResult] = await Promise.all([
        supabase
            .from('trophyuser')
            .select('trophy(trophyid, type, name, description)')
            .eq('userid', session.userid)
            .eq('sessionid', id),
        supabase
            .from('userbadge')
            .select('badges(badgeid, type, name, description)')
            .eq('userid', session.userid)
            .eq('sessionid', id),
    ]);

    if (trophyResult.error) throw trophyResult.error;
    if (badgeResult.error) throw badgeResult.error;

    const { data: report, error: reportError } = await supabase
        .from('report')
        .select('reportid, bashhistory, pidhistory')
        .eq('sessionid', id)
        .order('reportid', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (reportError) throw reportError;

    const trophies = trophyResult.data
        .map((row) => row.trophy)
        .filter(Boolean)
        .sort((a, b) => b.type - a.type || a.trophyid - b.trophyid);

    const badges = badgeResult.data
        .map((row) => row.badges)
        .filter(Boolean)
        .sort((a, b) => b.type - a.type || a.badgeid - b.badgeid);

    return { session, user: session.users, lab: session.lab, trophies, badges, report };
}

function formatDateTime(isoString) {
    if (!isoString) return '—';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '—';

    const day = date.toLocaleDateString('es-CL', { timeZone: TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' });
    const time = date.toLocaleTimeString('es-CL', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day}, ${time}`;
}

function formatDuration(startIso, endIso) {
    const ms = new Date(endIso) - new Date(startIso);
    if (!Number.isFinite(ms) || ms < 0) return '—';

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours > 0 && `${hours} h`, (hours > 0 || minutes > 0) && `${minutes} min`, `${seconds} s`]
        .filter(Boolean)
        .join(' ');
}

function truncate(text, max) {
    const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function bottomLimit() {
    return PAGE.height - MARGIN.bottom - FOOTER_HEIGHT;
}

function ensureSpace(doc, height) {
    if (doc.y + height > bottomLimit()) {
        doc.addPage();
        doc.y = MARGIN.top;
    }
}

function drawHeader(doc, { statusLabel }) {
    const top = MARGIN.top;
    const left = MARGIN.left;
    const right = PAGE.width - MARGIN.right;

    doc.font(FONTS.sansBold).fontSize(11).fillColor(COLORS.text)
        .text('CYRUXLABS', left, top + 9, { characterSpacing: 0.8, lineBreak: false });

    doc.font(FONTS.serifBold).fontSize(12.5)
        .text('REPORTE DE SESIÓN', left, top + 8, { width: CONTENT_WIDTH, align: 'center', characterSpacing: 2.2, lineBreak: false });

    const boxWidth = 108;
    const boxX = right - boxWidth;
    doc.lineWidth(0.8).strokeColor(COLORS.text);
    doc.rect(boxX, top, boxWidth, 11).fillAndStroke(COLORS.headerBg, COLORS.text);
    doc.rect(boxX, top + 11, boxWidth, 17).stroke();
    doc.fillColor(COLORS.text).font(FONTS.sans).fontSize(6.5)
        .text('ESTADO', boxX, top + 2.6, { width: boxWidth, align: 'center', characterSpacing: 1.5, lineBreak: false });
    doc.font(FONTS.sansBold).fontSize(9)
        .text(statusLabel, boxX, top + 15.5, { width: boxWidth, align: 'center', characterSpacing: 1.2, lineBreak: false });

    const lineY = top + 34;
    doc.lineWidth(1.5).moveTo(left, lineY).lineTo(right, lineY).stroke();
    doc.lineWidth(0.5).moveTo(left, lineY + 3).lineTo(right, lineY + 3).stroke();

    doc.y = lineY + 14;
}

function drawFooter(doc, { username, pageNumber, pageCount }) {
    const previousBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const y = PAGE.height - MARGIN.bottom - 10;
    const left = MARGIN.left;
    const right = PAGE.width - MARGIN.right;

    doc.lineWidth(0.5).strokeColor(COLORS.text).moveTo(left, y - 6).lineTo(right, y - 6).stroke();
    doc.font(FONTS.sans).fontSize(7.5).fillColor(COLORS.muted);
    doc.text(`CyruxLabs — ${username}`, left, y, { lineBreak: false });
    doc.text(`Página ${pageNumber} de ${pageCount}`, left, y, { width: CONTENT_WIDTH, align: 'right', lineBreak: false });

    doc.page.margins.bottom = previousBottom;
}

function drawSectionTitle(doc, number, title) {
    ensureSpace(doc, 40);
    doc.moveDown(0.6);
    doc.font(FONTS.serifBold).fontSize(10.5).fillColor(COLORS.text)
        .text(`${number}.   ${title.toUpperCase()}`, MARGIN.left, doc.y, { characterSpacing: 0.8 });
    doc.y += 5;
}

function drawSubTitle(doc, text) {
    ensureSpace(doc, 34);
    doc.y += 4;
    doc.font(FONTS.serifItalic).fontSize(9.5).fillColor(COLORS.text).text(text, MARGIN.left, doc.y);
    doc.y += 3;
}

function drawKeyValueTable(doc, rows) {
    const labelWidth = CONTENT_WIDTH * 0.34;
    const valueWidth = CONTENT_WIDTH - labelWidth;
    const padX = 7;
    const padY = 5;

    rows.forEach(({ label, value, mono = false }) => {
        const valueFont = mono ? FONTS.mono : FONTS.serif;
        const valueSize = mono ? 9 : 10.5;

        doc.font(valueFont).fontSize(valueSize);
        const valueHeight = doc.heightOfString(value, { width: valueWidth - padX * 2 });
        doc.font(FONTS.sans).fontSize(9);
        const labelHeight = doc.heightOfString(label, { width: labelWidth - padX * 2 });
        const rowHeight = Math.max(valueHeight, labelHeight) + padY * 2;

        ensureSpace(doc, rowHeight);
        const y = doc.y;

        doc.lineWidth(0.6).strokeColor(COLORS.border);
        doc.rect(MARGIN.left, y, labelWidth, rowHeight).fillAndStroke(COLORS.labelBg, COLORS.border);
        doc.rect(MARGIN.left + labelWidth, y, valueWidth, rowHeight).stroke();

        doc.fillColor(COLORS.label).font(FONTS.sans).fontSize(9)
            .text(label, MARGIN.left + padX, y + padY + 1, { width: labelWidth - padX * 2 });
        doc.fillColor(COLORS.text).font(valueFont).fontSize(valueSize)
            .text(value, MARGIN.left + labelWidth + padX, y + padY, { width: valueWidth - padX * 2 });

        doc.y = y + rowHeight;
    });
}

function drawListTable(doc, columns, rows, emptyText) {
    const padX = 7;
    const padY = 4;
    const widths = columns.map((c) => c.width * CONTENT_WIDTH);

    const drawRow = (cells, { header = false } = {}) => {
        const font = header ? FONTS.sansBold : FONTS.serif;
        const size = header ? 8 : 9.5;

        doc.font(font).fontSize(size);
        const height = Math.max(...cells.map((cell, i) => doc.heightOfString(cell, { width: widths[i] - padX * 2 }))) + padY * 2;

        ensureSpace(doc, height);
        const y = doc.y;
        let x = MARGIN.left;

        cells.forEach((cell, i) => {
            doc.lineWidth(0.6);
            if (header) doc.rect(x, y, widths[i], height).fillAndStroke(COLORS.headerBg, COLORS.borderDark);
            else doc.rect(x, y, widths[i], height).strokeColor(COLORS.border).stroke();

            doc.fillColor(COLORS.text).font(font).fontSize(size)
                .text(cell, x + padX, y + padY + (header ? 1 : 0), {
                    width: widths[i] - padX * 2,
                    characterSpacing: header ? 0.5 : 0,
                });
            x += widths[i];
        });

        doc.y = y + height;
    };

    drawRow(columns.map((c) => c.title.toUpperCase()), { header: true });

    if (rows.length === 0) {
        const height = 20;
        ensureSpace(doc, height);
        const y = doc.y;
        doc.lineWidth(0.6).rect(MARGIN.left, y, CONTENT_WIDTH, height).strokeColor(COLORS.border).stroke();
        doc.fillColor(COLORS.muted).font(FONTS.serifItalic).fontSize(9.5)
            .text(emptyText, MARGIN.left + padX, y + 5, { width: CONTENT_WIDTH - padX * 2 });
        doc.y = y + height;
        return;
    }

    rows.forEach((cells) => drawRow(cells));
}

// page1

function drawSummaryPage(doc, { session, user, lab, trophies, badges }, generatedAt) {
    const solved = !!session.issolved;
    const statusLabel = solved ? 'COMPLETADO' : 'NO COMPLETADO';

    drawHeader(doc, { statusLabel });

    // subtitulo
    doc.font(FONTS.serifBold).fontSize(15).fillColor(COLORS.text)
        .text(lab?.title ?? 'Laboratorio', MARGIN.left, doc.y, { width: CONTENT_WIDTH });
    doc.y += 6;

    {
        const y = doc.y;
        const cells = [
            { text: 'ID de la sesión', w: 0.17, label: true },
            { text: String(session.sessionid), w: 0.13 },
            { text: 'Fecha de emisión', w: 0.2, label: true },
            { text: `${formatDateTime(generatedAt)} (hora de Chile)`, w: 0.5 },
        ];
        const height = 18;
        let x = MARGIN.left;
        doc.lineWidth(0.6);
        cells.forEach((cell) => {
            const w = cell.w * CONTENT_WIDTH;
            if (cell.label) doc.rect(x, y, w, height).fillAndStroke('#f2f2f2', COLORS.borderDark);
            else doc.rect(x, y, w, height).strokeColor(COLORS.borderDark).stroke();
            doc.fillColor(cell.label ? COLORS.label : COLORS.text).font(FONTS.sans).fontSize(8.5)
                .text(cell.text, x + 6, y + 5, { width: w - 12, lineBreak: false });
            x += w;
        });
        doc.y = y + height + 4;
    }

    // usuario
    drawSectionTitle(doc, 1, 'Información del usuario');
    drawKeyValueTable(doc, [
        { label: 'Nombre y apellido', value: `${user?.firstname ?? ''} ${user?.lastname ?? ''}`.trim() || '—' },
        { label: 'Nombre de usuario', value: user?.username ?? '—' },
        { label: 'Estado', value: solved ? 'Completado' : 'No completado' },
    ]);

    // lab
    drawSectionTitle(doc, 2, 'Información del laboratorio');
    drawKeyValueTable(doc, [
        { label: 'Nombre del laboratorio', value: lab?.title ?? '—' },
        { label: 'Descripción', value: truncate(lab?.description, DESCRIPTION_MAX) || '—' },
        // Pendiente: cuando existan flags dinámicas, mostrar aquí la flag asignada a ESTA sesión
        { label: 'Flag designada', value: lab?.flag ?? '—', mono: true },
        { label: 'Flag obtenida', value: session.capturedflag || 'No obtenida', mono: !!session.capturedflag },
    ]);

    // sesion
    drawSectionTitle(doc, 3, 'Información de la sesión');
    drawKeyValueTable(doc, [
        { label: 'Fecha de inicio', value: formatDateTime(session.starttime) },
        { label: 'Fecha de término', value: formatDateTime(session.finishtime) },
        { label: 'Duración (último intento)', value: formatDuration(session.starttime, session.finishtime) },
        { label: 'Intentos de envío fallidos', value: String(session.failedflags ?? 0) },
        { label: 'Reinicios de la sesión', value: String(session.restartcount ?? 0) },
    ]);

    // trofeos / insignias
    drawSectionTitle(doc, 4, 'Trofeos e insignias obtenidos en esta sesión');

    drawSubTitle(doc, '4.1 Trofeos');
    drawListTable(
        doc,
        [{ title: 'Trofeo', width: 0.3 }, { title: 'Tipo', width: 0.14 }, { title: 'Descripción', width: 0.56 }],
        trophies.map((t) => [t.name, TROPHY_TYPE_LABELS[t.type] ?? '—', t.description]),
        'No se obtuvieron trofeos en esta sesión.'
    );

    drawSubTitle(doc, '4.2 Insignias');
    drawListTable(
        doc,
        [{ title: 'Insignia', width: 0.3 }, { title: 'Rareza', width: 0.14 }, { title: 'Descripción', width: 0.56 }],
        badges.map((b) => [b.name, BADGE_TYPE_LABELS[b.type] ?? '—', b.description]),
        'No se obtuvieron insignias en esta sesión.'
    );
}

// paginas de historial

function toPdfText(text) {
    return String(text ?? '')
        .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '') // colores ANSI
        .replace(/\t/g, '    ')
        .replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
}

function toLines(text) {
    return String(text ?? '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => toPdfText(line).trimEnd())
        .filter((line) => line.trim() !== '');
}

function drawSimpleHeader(doc) {
    const top = MARGIN.top;
    const left = MARGIN.left;
    const right = PAGE.width - MARGIN.right;

    doc.font(FONTS.serifBold).fontSize(12.5).fillColor(COLORS.text)
        .text('REPORTE DE SESIÓN', left, top + 8, { width: CONTENT_WIDTH, align: 'center', characterSpacing: 2.2, lineBreak: false });

    const lineY = top + 34;
    doc.lineWidth(1.5).strokeColor(COLORS.text).moveTo(left, lineY).lineTo(right, lineY).stroke();
    doc.lineWidth(0.5).moveTo(left, lineY + 3).lineTo(right, lineY + 3).stroke();

    doc.y = lineY + 14;
}

function drawHistoryPage(doc, data, { title, registry, text, numbered, emptyText }) {
    const lines = toLines(text);
    const context = `${data.lab?.title ?? 'Laboratorio'} — ${data.user?.username ?? ''}`;

    const LOG_SIZE = 8.4;
    const LINE_GAP = 2.6;
    const padX = 10;
    const padY = 8;
    const headHeight = 16;
    const numberWidth = numbered ? doc.font(FONTS.mono).fontSize(LOG_SIZE).widthOfString(`${lines.length}  `) + 6 : 0;
    const textWidth = CONTENT_WIDTH - padX * 2 - numberWidth;

    let page = 0;

    const startPage = () => {
        doc.addPage();
        drawSimpleHeader(doc);

        doc.font(FONTS.serifBold).fontSize(15).fillColor(COLORS.text)
            .text(page === 0 ? title : `${title} (continuación)`, MARGIN.left, doc.y, { width: CONTENT_WIDTH, align: 'center' });
        doc.y += 2;
        doc.font(FONTS.sans).fontSize(8.5).fillColor(COLORS.muted)
            .text(context, MARGIN.left, doc.y, { width: CONTENT_WIDTH, align: 'center' });
        doc.y += 10;

        const boxTop = doc.y;
        const boxBottom = bottomLimit() - 4;

        doc.lineWidth(0.8).strokeColor(COLORS.text);
        doc.rect(MARGIN.left, boxTop, CONTENT_WIDTH, headHeight).fillAndStroke('#ececec', COLORS.text);
        doc.rect(MARGIN.left, boxTop, CONTENT_WIDTH, boxBottom - boxTop).stroke();

        doc.fillColor(COLORS.text).font(FONTS.sans).fontSize(8);
        doc.text(`REGISTRO: ${registry.toUpperCase()}`, MARGIN.left + 8, boxTop + 4.5, { characterSpacing: 0.8, lineBreak: false });
        doc.text(`${lines.length} ${lines.length === 1 ? 'línea' : 'líneas'}`, MARGIN.left, boxTop + 4.5, {
            width: CONTENT_WIDTH - 8, align: 'right', lineBreak: false,
        });

        page += 1;
        doc.y = boxTop + headHeight + padY;
        return boxBottom - padY;
    };

    let limit = startPage();

    if (lines.length === 0) {
        doc.font(FONTS.serifItalic).fontSize(9.5).fillColor(COLORS.muted)
            .text(emptyText, MARGIN.left + padX, doc.y, { width: CONTENT_WIDTH - padX * 2 });
        return;
    }

    doc.font(FONTS.mono).fontSize(LOG_SIZE);

    lines.forEach((line, index) => {
        const height = doc.heightOfString(line, { width: textWidth, lineGap: LINE_GAP });
        if (doc.y + height > limit) {
            limit = startPage();
            doc.font(FONTS.mono).fontSize(LOG_SIZE);
        }

        const y = doc.y;
        if (numbered) {
            doc.fillColor(COLORS.muted)
                .text(String(index + 1), MARGIN.left + padX, y, { width: numberWidth - 8, align: 'right', lineBreak: false });
        }
        doc.fillColor(COLORS.text)
            .text(line, MARGIN.left + padX + numberWidth, y, { width: textWidth, lineGap: LINE_GAP });
        doc.y = y + height;
    });
}

export function buildSessionReportPdf(data, generatedAt = new Date().toISOString()) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: MARGIN.top, bottom: MARGIN.bottom, left: MARGIN.left, right: MARGIN.right },
            bufferPages: true,
            info: {
                Title: `Reporte de sesión N.º ${data.session.sessionid}`,
                Author: 'CyruxLabs',
                Subject: data.lab?.title ?? 'Reporte de sesión',
            },
        });

        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        drawSummaryPage(doc, data, generatedAt);

        drawHistoryPage(doc, data, {
            title: 'Historial de Terminal',
            registry: 'bash_history',
            text: data.report?.bashhistory,
            numbered: true,
            emptyText: 'Sin registros de terminal para esta sesión.',
        });

        drawHistoryPage(doc, data, {
            title: 'Historial de Procesos Ejecutados',
            registry: 'procesos',
            text: data.report?.pidhistory,
            numbered: false,
            emptyText: 'Sin registros de procesos para esta sesión.',
        });

        // pie de pagina
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            drawFooter(doc, {
                username: data.user?.username ?? '',
                pageNumber: i - range.start + 1,
                pageCount: range.count,
            });
        }

        doc.end();
    });
}
