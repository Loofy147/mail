use blitz_traits::node_id::NodeId;
use std::{ops::Range, sync::Arc};

use atomic_refcell::AtomicRefCell;
use markup5ever::local_name;
use style::color::AbsoluteColor;
use style::properties::ComputedValues;
use style::values::specified::box_::{DisplayInside, DisplayOutside};
use style::{
    Atom, computed_values::border_collapse::T as BorderCollapse,
    computed_values::table_layout::T as TableLayout, values::computed::BorderStyle,
};
use taffy::{
    DetailedGridInfo, LayoutPartialTree as _, ResolveOrZero, TrackSizingFunction, style_helpers,
};

use crate::BaseDocument;

use super::damage::{CONSTRUCT_BOX, CONSTRUCT_DESCENDENT, CONSTRUCT_FC};
use super::resolve_calc_value;

pub struct TableTreeWrapper<'doc> {
    pub(crate) doc: &'doc mut BaseDocument,
    pub(crate) ctx: Arc<TableContext>,
}

#[derive(Debug, Clone)]
pub struct TableContext {
    pub style: taffy::Style<Atom>,
    pub cells: Vec<TableCell>,
    pub rows: Vec<TableRow>,
    pub is_fixed: bool,
    pub computed_grid_info: AtomicRefCell<Option<DetailedGridInfo<Atom>>>,
    pub border_collapse: BorderCollapse,
    /// The resolved shared borders of a `border-collapse: collapse` table.
    /// When present, the table paints every border; cells and the table box
    /// do not paint their own.
    pub collapsed_borders: Option<CollapsedBorders>,
    /// Columns run right to left.
    pub rtl: bool,
    /// Set while laying out an auto table whose columns would otherwise
    /// overflow it: text-only cells then contribute no min-content width, so
    /// `overflow-wrap: break-word` wraps long words instead of the table
    /// growing past its container.
    pub relax_text_minimums: AtomicRefCell<bool>,
}

#[derive(Debug, Clone)]
pub struct TableCell {
    node_id: NodeId,
    style: taffy::Style<Atom>,
    vertical_align: CellVerticalAlign,
    /// Zero-based slot of the cell's first row and column.
    row: u16,
    column: u16,
    rowspan: u16,
    colspan: u16,
    /// In the collapsed model, the part of each resolved edge inside the cell.
    collapsed_border: Option<taffy::Rect<f32>>,
    /// The authored `width`; the grid item itself is always auto-sized.
    authored_width: taffy::Dimension,
}

/// How a cell positions its content within the height of its row(s).
///
/// `baseline` is approximated as `top`: aligning first baselines across a row
/// would need the cell box itself to move, which would detach its background
/// from the row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CellVerticalAlign {
    Top,
    Middle,
    Bottom,
}

impl CellVerticalAlign {
    fn from_style(style: &ComputedValues) -> Self {
        use style::values::computed::box_::AlignmentBaseline;
        use style::values::generics::box_::{BaselineShift, BaselineShiftKeyword};
        // `vertical-align` is a shorthand: `top`/`bottom` become baseline
        // shifts, `middle` an alignment baseline.
        match style.clone_baseline_shift() {
            BaselineShift::Keyword(BaselineShiftKeyword::Top) => return Self::Top,
            BaselineShift::Keyword(BaselineShiftKeyword::Bottom) => return Self::Bottom,
            BaselineShift::Keyword(BaselineShiftKeyword::Center) => return Self::Middle,
            _ => {}
        }
        match style.clone_alignment_baseline() {
            AlignmentBaseline::Middle => Self::Middle,
            _ => Self::Top,
        }
    }
}

#[derive(Debug, Clone)]
pub struct TableRow {
    pub node_id: NodeId,
    pub height: f32,
    /// Zero-based grid row. A table may also have an anonymous first row for
    /// cells outside any `<tr>`, which has no entry here.
    pub index: u16,
}

/// One resolved edge of the collapsed border model.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CollapsedEdge {
    pub width: f32,
    pub style: BorderStyle,
    pub color: AbsoluteColor,
}

impl CollapsedEdge {
    /// The part of the edge before (above or left of) its grid line. Odd
    /// pixel widths put the extra pixel after the line, so a 1px border sits
    /// on whole pixels instead of straddling two.
    pub fn before(&self) -> f32 {
        (self.width / 2.0).floor()
    }

    /// The part of the edge after (below or right of) its grid line.
    pub fn after(&self) -> f32 {
        self.width - self.before()
    }
}

/// The winning border of every edge between the slots of a collapsed table.
///
/// Vertical lines are numbered in column order, so in a right-to-left table
/// line 0 is the right edge, and an edge's `before` part lies to its right.
#[derive(Debug, Clone)]
pub struct CollapsedBorders {
    pub rows: usize,
    pub columns: usize,
    /// `(rows + 1) * columns` edges: the line above each row, then the bottom.
    horizontal: Vec<Option<CollapsedEdge>>,
    /// `rows * (columns + 1)` edges: the line before each column, then the end.
    vertical: Vec<Option<CollapsedEdge>>,
}

impl CollapsedBorders {
    /// The edge on horizontal line `line` (0..=rows) over `column`.
    pub fn horizontal(&self, line: usize, column: usize) -> Option<&CollapsedEdge> {
        self.horizontal.get(line * self.columns + column)?.as_ref()
    }

    /// The edge on vertical line `line` (0..=columns) beside `row`.
    pub fn vertical(&self, row: usize, line: usize) -> Option<&CollapsedEdge> {
        self.vertical.get(row * (self.columns + 1) + line)?.as_ref()
    }
}

const TOP: usize = 0;
const RIGHT: usize = 1;
const BOTTOM: usize = 2;
const LEFT: usize = 3;

/// A border that competes for a shared edge, with the precedence of the box
/// it came from: cell 4, row 3, row group 2, table 1.
#[derive(Debug, Clone, Copy)]
struct BorderCandidate {
    width: f32,
    style: BorderStyle,
    color: AbsoluteColor,
    origin: u8,
}

fn border_candidates(style: &ComputedValues, origin: u8) -> [BorderCandidate; 4] {
    let border = style.get_border();
    let current_color = style.clone_color();
    let side = |width: app_units::Au, style: BorderStyle, color: &style::values::computed::Color| {
        BorderCandidate {
            width: width.to_f32_px(),
            style,
            color: color.resolve_to_absolute(&current_color),
            origin,
        }
    };
    [
        side(
            border.border_top_width.0,
            border.border_top_style,
            &border.border_top_color,
        ),
        side(
            border.border_right_width.0,
            border.border_right_style,
            &border.border_right_color,
        ),
        side(
            border.border_bottom_width.0,
            border.border_bottom_style,
            &border.border_bottom_color,
        ),
        side(
            border.border_left_width.0,
            border.border_left_style,
            &border.border_left_color,
        ),
    ]
}

/// CSS 2.1 §17.6.2.1 border conflict resolution.
fn resolve_edge(candidates: &[BorderCandidate]) -> Option<CollapsedEdge> {
    fn style_rank(style: BorderStyle) -> u8 {
        match style {
            BorderStyle::Double => 8,
            BorderStyle::Solid => 7,
            BorderStyle::Dashed => 6,
            BorderStyle::Dotted => 5,
            BorderStyle::Ridge => 4,
            BorderStyle::Outset => 3,
            BorderStyle::Groove => 2,
            BorderStyle::Inset => 1,
            BorderStyle::None | BorderStyle::Hidden => 0,
        }
    }

    let mut best: Option<&BorderCandidate> = None;
    for candidate in candidates {
        // `hidden` suppresses every other border on the edge.
        if candidate.style == BorderStyle::Hidden {
            return None;
        }
        if candidate.style == BorderStyle::None || candidate.width <= 0.0 {
            continue;
        }
        let wins = best.is_none_or(|best| {
            (candidate.width, style_rank(candidate.style), candidate.origin)
                > (best.width, style_rank(best.style), best.origin)
        });
        if wins {
            best = Some(candidate);
        }
    }
    best.map(|best| CollapsedEdge {
        width: best.width,
        style: best.style,
        color: best.color,
    })
}

/// Grids beyond this many slots skip collapsed resolution, which needs a
/// slot map, and fall back to each cell painting its own borders.
const MAX_COLLAPSED_SLOTS: usize = 1 << 20;

/// HTML caps `colspan` at 1000; rows are bounded by Taffy's `i16` lines.
const MAX_COLSPAN: u16 = 1000;
const MAX_GRID_LINE: u16 = i16::MAX as u16 - 1;

struct TableCollector {
    collapse: bool,
    /// Rows started so far; the current row is `row - 1`.
    row: u16,
    /// The next candidate column in the current row.
    col: u16,
    /// Per column, how many rows (including the current one) are still
    /// covered by a `rowspan` from an earlier row.
    occupied: Vec<u16>,
    cells: Vec<TableCell>,
    cell_borders: Vec<[BorderCandidate; 4]>,
    rows: Vec<TableRow>,
    row_borders: Vec<(u16, [BorderCandidate; 4])>,
    /// Row groups as (first row, last row, borders).
    groups: Vec<(u16, u16, [BorderCandidate; 4])>,
    columns: usize,
}

pub(crate) fn build_table_context(
    doc: &mut BaseDocument,
    table_root_node_id: NodeId,
) -> (TableContext, Vec<NodeId>) {
    let root_node = &mut doc.nodes[table_root_node_id];

    let children = std::mem::take(&mut root_node.children);

    let Some(stylo_styles) = root_node.primary_styles() else {
        panic!("Ignoring table because it has no styles");
    };

    let mut style = stylo_taffy::to_taffy_style(&stylo_styles);
    style.item_is_table = true;
    // Cells are placed explicitly into the slots the HTML table model
    // assigns; any implicit track would be a model error.
    style.grid_auto_flow = taffy::GridAutoFlow::RowDense;
    style.grid_auto_columns = Vec::new();
    style.grid_auto_rows = Vec::new();

    let is_fixed = match stylo_styles.clone_table_layout() {
        TableLayout::Fixed => true,
        TableLayout::Auto => false,
    };

    let border_collapse = stylo_styles.clone_border_collapse();
    let border_spacing = stylo_styles.clone_border_spacing().0;
    let table_borders = border_candidates(&stylo_styles, 1);
    let rtl = stylo_styles.clone_direction() == style::computed_values::direction::T::Rtl;

    drop(stylo_styles);

    let mut collector = TableCollector {
        collapse: border_collapse == BorderCollapse::Collapse,
        row: 0,
        col: 0,
        occupied: Vec::new(),
        cells: Vec::new(),
        cell_borders: Vec::new(),
        rows: Vec::new(),
        row_borders: Vec::new(),
        groups: Vec::new(),
        columns: 0,
    };
    for child_id in children.iter().copied() {
        collector.collect(doc, child_id);
    }
    let TableCollector {
        row: row_count,
        mut cells,
        cell_borders,
        rows,
        row_borders,
        groups,
        columns: column_count,
        ..
    } = collector;

    // A rowspan never extends past the last row.
    for cell in &mut cells {
        cell.rowspan = cell.rowspan.min(row_count - cell.row);
        cell.style.grid_row.end = style_helpers::span(cell.rowspan);
    }

    style.grid_template_rows = vec![style_helpers::auto(); row_count as usize];

    let mut collapsed_borders = None;
    style.gap = match border_collapse {
        BorderCollapse::Separate => {
            // In the separated borders model, `border-spacing` also applies between
            // the table border and the outermost cells, in addition to between cells.
            let spacing_x = border_spacing.width.px();
            let spacing_y = border_spacing.height.px();
            let padding = style.padding.resolve_or_zero(None, resolve_calc_value);
            style.padding = taffy::Rect {
                left: style_helpers::length(padding.left + spacing_x),
                right: style_helpers::length(padding.right + spacing_x),
                top: style_helpers::length(padding.top + spacing_y),
                bottom: style_helpers::length(padding.bottom + spacing_y),
            };
            taffy::Size {
                width: style_helpers::length(spacing_x),
                height: style_helpers::length(spacing_y),
            }
        }
        BorderCollapse::Collapse => {
            // Tables have no padding in the collapsed model, and borders are
            // shared at row and column boundaries rather than spaced apart.
            style.padding = taffy::Rect::ZERO.map(style_helpers::length);
            let slots = usize::from(row_count) * column_count;
            if slots > 0 && slots <= MAX_COLLAPSED_SLOTS {
                let borders = resolve_collapsed_borders(
                    usize::from(row_count),
                    column_count,
                    rtl,
                    &mut cells,
                    &cell_borders,
                    &row_borders,
                    &groups,
                    &table_borders,
                );
                // The table box holds the outer half of its edges.
                let outer = |edges: &mut dyn Iterator<Item = Option<&CollapsedEdge>>,
                             part: fn(&CollapsedEdge) -> f32| {
                    style_helpers::length(edges.flatten().map(part).fold(0.0, f32::max))
                };
                let (rows_n, cols_n) = (borders.rows, borders.columns);
                let start_border = outer(
                    &mut (0..rows_n).map(|r| borders.vertical(r, 0)),
                    CollapsedEdge::before,
                );
                let end_border = outer(
                    &mut (0..rows_n).map(|r| borders.vertical(r, cols_n)),
                    CollapsedEdge::after,
                );
                let (left, right) = if rtl {
                    (end_border, start_border)
                } else {
                    (start_border, end_border)
                };
                style.border = taffy::Rect {
                    top: outer(
                        &mut (0..cols_n).map(|c| borders.horizontal(0, c)),
                        CollapsedEdge::before,
                    ),
                    bottom: outer(
                        &mut (0..cols_n).map(|c| borders.horizontal(rows_n, c)),
                        CollapsedEdge::after,
                    ),
                    left,
                    right,
                };
                collapsed_borders = Some(borders);
            } else {
                // Without resolution, the table and its cells keep their own
                // visible borders.
                let visible = |side: &BorderCandidate| {
                    if side.style.none_or_hidden() {
                        0.0
                    } else {
                        side.width
                    }
                };
                style.border = taffy::Rect {
                    top: style_helpers::length(visible(&table_borders[TOP])),
                    right: style_helpers::length(visible(&table_borders[RIGHT])),
                    bottom: style_helpers::length(visible(&table_borders[BOTTOM])),
                    left: style_helpers::length(visible(&table_borders[LEFT])),
                };
            }
            taffy::Size::ZERO.map(style_helpers::length)
        }
    };

    // Column widths come from the cells' authored widths, measured with the
    // borders the cells actually have (resolved half-edges when collapsed).
    // Fixed layout takes its columns from the first row alone. Auto layout
    // considers every row, since a first-row heading often spans columns.
    let mut column_hints = vec![ColumnHint::default(); column_count];
    for cell in &cells {
        if is_fixed && cell.row != 0 {
            continue;
        }
        let (first, end) = (
            usize::from(cell.column),
            usize::from(cell.column) + usize::from(cell.colspan),
        );
        let hint = ColumnHint::from_cell(cell);
        if cell.colspan == 1 {
            column_hints[first].merge(&hint);
        } else if is_fixed {
            // A spanning cell in the fixed first row divides its width.
            let share = hint.split(cell.colspan);
            for hint in &mut column_hints[first..end] {
                hint.merge(&share);
            }
        }
    }
    // When every column has an authored length in a table of definite width,
    // browsers grow those columns in proportion to the authored widths.
    let table_width_is_definite = style.size.width.tag() != taffy::CompactLength::AUTO_TAG;
    let all_lengths = !column_hints.is_empty()
        && column_hints
            .iter()
            .all(|hint| hint.length.is_some() && hint.percent.is_none());
    let grow_lengths = !is_fixed && table_width_is_definite && all_lengths;
    style.grid_template_columns = column_hints
        .iter()
        .map(|hint| hint.track(is_fixed, grow_lengths).into())
        .collect();

    let layout_children = cells.iter().map(|cell| cell.node_id).collect();
    let root_node = &mut doc.nodes[table_root_node_id];
    root_node.children = children;

    (
        TableContext {
            style,
            cells,
            rows,
            is_fixed,
            computed_grid_info: AtomicRefCell::new(None),
            border_collapse,
            collapsed_borders,
            rtl,
            relax_text_minimums: AtomicRefCell::new(false),
        },
        layout_children,
    )
}

#[allow(clippy::too_many_arguments)]
fn resolve_collapsed_borders(
    rows: usize,
    columns: usize,
    rtl: bool,
    cells: &mut [TableCell],
    cell_borders: &[[BorderCandidate; 4]],
    row_borders: &[(u16, [BorderCandidate; 4])],
    groups: &[(u16, u16, [BorderCandidate; 4])],
    table_borders: &[BorderCandidate; 4],
) -> CollapsedBorders {
    const EMPTY: u32 = u32::MAX;
    // The physical sides at the start and end of each row.
    let (start, end) = if rtl { (RIGHT, LEFT) } else { (LEFT, RIGHT) };
    let mut owners = vec![EMPTY; rows * columns];
    for (index, cell) in cells.iter().enumerate() {
        for row in cell.row..cell.row + cell.rowspan {
            for column in cell.column..cell.column + cell.colspan {
                let slot = &mut owners[usize::from(row) * columns + usize::from(column)];
                // Overlapping cells are a table model error; the first wins.
                if *slot == EMPTY {
                    *slot = index as u32;
                }
            }
        }
    }
    let owner = |row: usize, column: usize| {
        let owner = owners[row * columns + column];
        (owner != EMPTY).then_some(owner as usize)
    };

    let mut row_sides: Vec<Option<&[BorderCandidate; 4]>> = vec![None; rows];
    for (row, borders) in row_borders {
        row_sides[usize::from(*row)] = Some(borders);
    }
    let mut group_of_row: Vec<Option<&(u16, u16, [BorderCandidate; 4])>> = vec![None; rows];
    for group in groups {
        for row in group.0..=group.1 {
            group_of_row[usize::from(row)] = Some(group);
        }
    }

    let mut candidates = Vec::with_capacity(8);
    let mut horizontal = Vec::with_capacity((rows + 1) * columns);
    for line in 0..=rows {
        for column in 0..columns {
            let above = (line > 0).then(|| owner(line - 1, column)).flatten();
            let below = (line < rows).then(|| owner(line, column)).flatten();
            if above.is_some() && above == below {
                horizontal.push(None);
                continue;
            }
            candidates.clear();
            candidates.extend(above.map(|cell| cell_borders[cell][BOTTOM]));
            candidates.extend(below.map(|cell| cell_borders[cell][TOP]));
            if line > 0 {
                candidates.extend(row_sides[line - 1].map(|row| row[BOTTOM]));
                if let Some(group) = group_of_row[line - 1].filter(|g| usize::from(g.1) == line - 1)
                {
                    candidates.push(group.2[BOTTOM]);
                }
            }
            if line < rows {
                candidates.extend(row_sides[line].map(|row| row[TOP]));
                if let Some(group) = group_of_row[line].filter(|g| usize::from(g.0) == line) {
                    candidates.push(group.2[TOP]);
                }
            }
            if line == 0 {
                candidates.push(table_borders[TOP]);
            }
            if line == rows {
                candidates.push(table_borders[BOTTOM]);
            }
            horizontal.push(resolve_edge(&candidates));
        }
    }

    let mut vertical = Vec::with_capacity(rows * (columns + 1));
    for row in 0..rows {
        for line in 0..=columns {
            // In column order: the cell before the line and the one after it.
            let left = (line > 0).then(|| owner(row, line - 1)).flatten();
            let right = (line < columns).then(|| owner(row, line)).flatten();
            if left.is_some() && left == right {
                vertical.push(None);
                continue;
            }
            candidates.clear();
            candidates.extend(left.map(|cell| cell_borders[cell][end]));
            candidates.extend(right.map(|cell| cell_borders[cell][start]));
            if line == 0 || line == columns {
                let side = if line == 0 { start } else { end };
                candidates.extend(row_sides[row].map(|row| row[side]));
                candidates.extend(group_of_row[row].map(|group| group.2[side]));
                candidates.push(table_borders[side]);
            }
            vertical.push(resolve_edge(&candidates));
        }
    }

    let borders = CollapsedBorders {
        rows,
        columns,
        horizontal,
        vertical,
    };

    for cell in cells.iter_mut() {
        let (first_row, first_column) = (usize::from(cell.row), usize::from(cell.column));
        let last_row = first_row + usize::from(cell.rowspan);
        let last_column = first_column + usize::from(cell.colspan);
        let widest = |edges: &mut dyn Iterator<Item = Option<&CollapsedEdge>>,
                      part: fn(&CollapsedEdge) -> f32| {
            edges.flatten().map(part).fold(0.0, f32::max)
        };
        let start_half = widest(
            &mut (first_row..last_row).map(|r| borders.vertical(r, first_column)),
            CollapsedEdge::after,
        );
        let end_half = widest(
            &mut (first_row..last_row).map(|r| borders.vertical(r, last_column)),
            CollapsedEdge::before,
        );
        let (left, right) = if rtl {
            (end_half, start_half)
        } else {
            (start_half, end_half)
        };
        let half = taffy::Rect {
            top: widest(
                &mut (first_column..last_column).map(|c| borders.horizontal(first_row, c)),
                CollapsedEdge::after,
            ),
            bottom: widest(
                &mut (first_column..last_column).map(|c| borders.horizontal(last_row, c)),
                CollapsedEdge::before,
            ),
            left,
            right,
        };
        cell.style.border = half.map(style_helpers::length);
        cell.collapsed_border = Some(half);
    }

    borders
}

impl TableCollector {
    fn start_row(&mut self) {
        self.row = self.row.saturating_add(1).min(MAX_GRID_LINE);
        self.col = 0;
        for remaining in &mut self.occupied {
            *remaining = remaining.saturating_sub(1);
        }
    }

    fn collect(&mut self, doc: &mut BaseDocument, node_id: NodeId) {
        let node = &mut doc.nodes[node_id];

        if !node.is_element() {
            return;
        }

        let Some(display) = node.primary_styles().map(|s| s.clone_display()) else {
            #[cfg(feature = "tracing")]
            tracing::info!("Ignoring table descendent because it has no styles");
            return;
        };

        if display.outside() == DisplayOutside::None {
            node.remove_damage(CONSTRUCT_DESCENDENT | CONSTRUCT_FC | CONSTRUCT_BOX);
            return;
        }

        match display.inside() {
            DisplayInside::TableRowGroup
            | DisplayInside::TableHeaderGroup
            | DisplayInside::TableFooterGroup
            | DisplayInside::Contents => {
                let group_borders = (self.collapse
                    && display.inside() != DisplayInside::Contents)
                    .then(|| node.primary_styles().map(|s| border_candidates(&s, 2)))
                    .flatten();
                let first_row = self.row;
                let children = std::mem::take(&mut doc.nodes[node_id].children);
                for child_id in children.iter().copied() {
                    doc.nodes[child_id]
                        .remove_damage(CONSTRUCT_DESCENDENT | CONSTRUCT_FC | CONSTRUCT_BOX);
                    self.collect(doc, child_id);
                }
                doc.nodes[node_id].children = children;
                if let Some(borders) = group_borders {
                    if self.row > first_row {
                        self.groups.push((first_row, self.row - 1, borders));
                    }
                }
            }
            DisplayInside::TableRow => {
                node.remove_damage(CONSTRUCT_DESCENDENT | CONSTRUCT_FC | CONSTRUCT_BOX);
                let row_borders = self
                    .collapse
                    .then(|| node.primary_styles().map(|s| border_candidates(&s, 3)))
                    .flatten();
                self.start_row();
                let index = self.row - 1;
                self.rows.push(TableRow {
                    node_id,
                    height: 0.0,
                    index,
                });
                if let Some(borders) = row_borders {
                    self.row_borders.push((index, borders));
                }

                let children = std::mem::take(&mut doc.nodes[node_id].children);
                for child_id in children.iter().copied() {
                    self.collect(doc, child_id);
                }
                doc.nodes[node_id].children = children;
            }
            DisplayInside::TableCell => self.push_cell(doc, node_id, true),
            DisplayInside::Flow
            | DisplayInside::FlowRoot
            | DisplayInside::Flex
            | DisplayInside::Grid => {
                if display.outside() == DisplayOutside::TableCaption {
                    node.remove_damage(CONSTRUCT_DESCENDENT | CONSTRUCT_FC | CONSTRUCT_BOX);
                } else {
                    // CSS table fixup wraps an otherwise invalid child in
                    // anonymous row/cell boxes. Floats blockify `display:
                    // table-cell` elements into flow boxes, which is common in
                    // responsive email layouts. Treat the existing node as the
                    // anonymous grid cell so its complete subtree still lays out.
                    self.push_cell(doc, node_id, false);
                }
            }
            DisplayInside::TableColumnGroup
            | DisplayInside::TableColumn
            | DisplayInside::Table => {
                node.remove_damage(CONSTRUCT_DESCENDENT | CONSTRUCT_FC | CONSTRUCT_BOX);
                //Ignore
            }
            DisplayInside::None => {
                node.remove_damage(CONSTRUCT_DESCENDENT | CONSTRUCT_FC | CONSTRUCT_BOX);
                // Ignore
            }
        }
    }

    fn push_cell(&mut self, doc: &mut BaseDocument, node_id: NodeId, use_spans: bool) {
        // A table without an explicit row still gets an anonymous first row.
        if self.row == 0 {
            self.start_row();
        }

        let node = &mut doc.nodes[node_id];
        // https://html.spec.whatwg.org/multipage/tables.html#forming-a-table
        let colspan: u16 = use_spans
            .then(|| node.attr(local_name!("colspan")))
            .flatten()
            .and_then(|val| val.trim().parse::<u16>().ok())
            .map(|v| v.clamp(1, MAX_COLSPAN))
            .unwrap_or(1);
        // `rowspan="0"` spans the remaining rows; the end of the table clamps it.
        let rowspan: u16 = use_spans
            .then(|| node.attr(local_name!("rowspan")))
            .flatten()
            .and_then(|val| val.trim().parse::<u16>().ok())
            .map(|v| if v == 0 { MAX_GRID_LINE } else { v })
            .unwrap_or(1);
        let (mut style, borders, vertical_align) = {
            let stylo_style = node.primary_styles().unwrap();
            (
                stylo_taffy::to_taffy_style(&stylo_style),
                border_candidates(&stylo_style, 4),
                CellVerticalAlign::from_style(&stylo_style),
            )
        };

        // Skip slots still covered by a rowspan from an earlier row.
        let mut column = usize::from(self.col);
        while self.occupied.get(column).is_some_and(|&rows| rows > 0) {
            column += 1;
        }
        let column = column.min(usize::from(MAX_GRID_LINE - MAX_COLSPAN));
        let end = column + usize::from(colspan);
        if self.occupied.len() < end {
            self.occupied.resize(end, 0);
        }
        for remaining in &mut self.occupied[column..end] {
            *remaining = rowspan;
        }
        self.col = end as u16;
        self.columns = self.columns.max(end);
        let row = self.row - 1;

        if self.collapse {
            // Replaced by the resolved half-edges once every border is known.
            // Until then only visible borders take space: a `none` border has
            // no width in the collapsed model.
            let visible = |side: &BorderCandidate| {
                if side.style.none_or_hidden() {
                    0.0
                } else {
                    side.width
                }
            };
            style.border = taffy::Rect {
                top: style_helpers::length(visible(&borders[TOP])),
                right: style_helpers::length(visible(&borders[RIGHT])),
                bottom: style_helpers::length(visible(&borders[BOTTOM])),
                left: style_helpers::length(visible(&borders[LEFT])),
            };
        }

        // The margin properties do not apply to table-internal elements.
        style.margin = taffy::Rect::ZERO.map(style_helpers::length);

        style.grid_column = taffy::Line {
            start: style_helpers::line(column as i16 + 1),
            end: style_helpers::span(colspan),
        };
        style.grid_row = taffy::Line {
            start: style_helpers::line(row as i16 + 1),
            end: style_helpers::span(rowspan),
        };
        let authored_width = style.size.width;
        style.size.width = style_helpers::auto();
        // Cells always fill their row. An authored height is a minimum, which
        // the row already honours through the cell's measured size.
        style.size.height = style_helpers::auto();
        style.min_size.height = style_helpers::auto();
        style.max_size.height = style_helpers::auto();
        self.cells.push(TableCell {
            node_id,
            style,
            vertical_align,
            row,
            column: column as u16,
            rowspan,
            colspan,
            collapsed_border: None,
            authored_width,
        });
        self.cell_borders.push(borders);
    }
}

/// What the cells of one column ask for, before it becomes a grid track.
#[derive(Debug, Clone, Default)]
pub(crate) struct ColumnHint {
    /// The widest authored border-box length.
    length: Option<f32>,
    /// The widest authored percentage, as a fraction.
    percent: Option<f32>,
    /// A `calc()` width, which only fixed layout resolves.
    calc: Option<taffy::Dimension>,
}

impl ColumnHint {
    fn from_cell(cell: &TableCell) -> Self {
        let style = &cell.style;
        let width = cell.authored_width;
        match width.tag() {
            taffy::CompactLength::LENGTH_TAG => {
                let padding = style.padding.resolve_or_zero(None, resolve_calc_value);
                let border = style.border.resolve_or_zero(None, resolve_calc_value);
                let length = match style.box_sizing {
                    taffy::BoxSizing::ContentBox => {
                        width.value() + padding.left + padding.right + border.left + border.right
                    }
                    taffy::BoxSizing::BorderBox => width.value(),
                };
                Self {
                    length: Some(length),
                    ..Self::default()
                }
            }
            taffy::CompactLength::PERCENT_TAG => Self {
                percent: Some(width.value()),
                ..Self::default()
            },
            taffy::CompactLength::AUTO_TAG => Self::default(),
            // Dimension values are always length, percentage, auto or calc().
            _ => Self {
                calc: Some(width),
                ..Self::default()
            },
        }
    }

    fn merge(&mut self, other: &Self) {
        self.length = max_option(self.length, other.length);
        self.percent = max_option(self.percent, other.percent);
        if self.calc.is_none() {
            self.calc = other.calc;
        }
    }

    fn split(&self, columns: u16) -> Self {
        let columns = f32::from(columns.max(1));
        Self {
            length: self.length.map(|length| length / columns),
            percent: self.percent.map(|percent| percent / columns),
            calc: None,
        }
    }

    fn track(&self, is_fixed: bool, grow_lengths: bool) -> TrackSizingFunction {
        if is_fixed {
            return match (self.length, self.percent, self.calc) {
                (Some(length), _, _) => style_helpers::length(length),
                (_, Some(percent), _) => style_helpers::percent(percent),
                // Pass calc() through so Taffy resolves it against the
                // table's inner width.
                (_, _, Some(calc)) => calc.into(),
                _ => style_helpers::auto(),
            };
        }

        // Auto layout never shrinks a column below its content's min-content
        // width; the cell measurement folds an authored length into that
        // floor (see `compute_child_layout`). Over-wide content therefore
        // widens the table instead of painting over neighbouring cells.
        //
        // The minimum is `min-content` rather than `auto`: grid clamps an
        // `auto` minimum to a fixed maximum, which would let a 120px image
        // overflow a `width="50"` column.
        let max = if let Some(percent) = self.percent {
            // A percentage is the column's preferred share of the table.
            taffy::MaxTrackSizingFunction::percent(percent)
        } else if let Some(length) = self.length {
            if grow_lengths {
                taffy::MaxTrackSizingFunction::fr(length.max(f32::EPSILON))
            } else {
                // Spare width goes to auto columns before authored ones.
                taffy::MaxTrackSizingFunction::length(length)
            }
        } else {
            taffy::MaxTrackSizingFunction::auto()
        };
        style_helpers::minmax(taffy::MinTrackSizingFunction::min_content(), max)
    }
}

fn max_option(a: Option<f32>, b: Option<f32>) -> Option<f32> {
    match (a, b) {
        (Some(a), Some(b)) => Some(a.max(b)),
        (a, b) => a.or(b),
    }
}

pub struct RangeIter(Range<usize>);

impl Iterator for RangeIter {
    type Item = taffy::NodeId;

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(taffy::NodeId::from)
    }
}

impl taffy::TraversePartialTree for TableTreeWrapper<'_> {
    type ChildIter<'a>
        = RangeIter
    where
        Self: 'a;

    #[inline(always)]
    fn child_ids(&self, _node_id: taffy::NodeId) -> Self::ChildIter<'_> {
        RangeIter(0..self.ctx.cells.len())
    }

    #[inline(always)]
    fn child_count(&self, _node_id: taffy::NodeId) -> usize {
        self.ctx.cells.len()
    }

    #[inline(always)]
    fn get_child_id(&self, _node_id: taffy::NodeId, index: usize) -> taffy::NodeId {
        index.into()
    }
}
impl taffy::TraverseTree for TableTreeWrapper<'_> {}

impl taffy::LayoutPartialTree for TableTreeWrapper<'_> {
    type CoreContainerStyle<'a>
        = &'a taffy::Style<Atom>
    where
        Self: 'a;

    type CustomIdent = Atom;

    fn get_core_container_style(&self, _node_id: taffy::NodeId) -> &taffy::Style<Atom> {
        &self.ctx.style
    }

    fn resolve_calc_value(&self, calc_ptr: *const (), parent_size: f32) -> f32 {
        resolve_calc_value(calc_ptr, parent_size)
    }

    fn set_unrounded_layout(&mut self, node_id: taffy::NodeId, layout: &taffy::Layout) {
        let node_id = crate::taffy_node_id(self.ctx.cells[usize::from(node_id)].node_id);
        self.doc.set_unrounded_layout(node_id, layout)
    }

    fn compute_child_layout(
        &mut self,
        node_id: taffy::NodeId,
        inputs: taffy::tree::LayoutInput,
    ) -> taffy::LayoutOutput {
        let cell = &self.ctx.cells[usize::from(node_id)];
        let dom_id = cell.node_id;
        let vertical_align = cell.vertical_align;
        let collapsed_border = cell.collapsed_border;
        let node_id = crate::taffy_node_id(dom_id);
        // In the collapsed model a cell's box holds its share of each
        // resolved edge, not its own authored border.
        let own_border = self.doc.nodes[dom_id].style().border;
        if let Some(half) = collapsed_border {
            self.doc.nodes[dom_id].style_mut().border = half.map(style_helpers::length);
        }
        // The document layout pass restores the authored cell width after the
        // table context is built. In auto layout that width is a minimum for
        // the column, not a constraint on the cell's contents: measure the
        // cell as `min-width: W` so its contributions are max(W, content).
        let width = self.doc.nodes[dom_id].style().size.width;
        let min_width = self.doc.nodes[dom_id].style().min_size.width;
        let measure_without_width =
            !self.ctx.is_fixed && width.tag() == taffy::CompactLength::LENGTH_TAG;
        if measure_without_width {
            let style = self.doc.nodes[dom_id].style_mut();
            style.size.width = style_helpers::auto();
            if min_width.is_auto() {
                style.min_size.width = taffy::LengthPercentageAuto::length(width.value());
            }
        }

        let offset = match (vertical_align, inputs.run_mode, inputs.known_dimensions) {
            (
                CellVerticalAlign::Middle | CellVerticalAlign::Bottom,
                taffy::RunMode::PerformLayout,
                taffy::Size {
                    width: Some(cell_width),
                    height: Some(cell_height),
                },
            ) => {
                let content_height = self.cell_content_height(dom_id, cell_width, &inputs);
                let free = (cell_height - content_height).max(0.0);
                if vertical_align == CellVerticalAlign::Middle {
                    free / 2.0
                } else {
                    free
                }
            }
            _ => 0.0,
        };

        let mut output = if offset > 0.0 {
            // CSS 2.1 places the extra space above the content of a middle or
            // bottom aligned cell. Lay the cell out with that space as
            // additional top padding, so block and inline content move as one.
            let padding_top = self.doc.nodes[dom_id].style().padding.top;
            let resolved =
                padding_top.resolve_or_zero(inputs.parent_size.width, resolve_calc_value);
            self.doc.nodes[dom_id].style_mut().padding.top =
                style_helpers::length(resolved + offset);
            let output = self.doc.compute_child_layout(node_id, inputs);
            self.doc.nodes[dom_id].style_mut().padding.top = padding_top;
            output
        } else {
            self.doc.compute_child_layout(node_id, inputs)
        };

        if *self.ctx.relax_text_minimums.borrow()
            && inputs.run_mode == taffy::RunMode::ComputeSize
            && inputs.known_dimensions.width.is_none()
            && inputs.available_space.width == taffy::AvailableSpace::MinContent
            && !measure_without_width
            && wraps_text_only(self.doc, dom_id)
        {
            let style = self.doc.nodes[dom_id].style();
            let padding = style.padding.resolve_or_zero(None, resolve_calc_value);
            let border = style.border.resolve_or_zero(None, resolve_calc_value);
            output.size.width = output
                .size
                .width
                .min(padding.left + padding.right + border.left + border.right);
        }

        if measure_without_width {
            let style = self.doc.nodes[dom_id].style_mut();
            style.size.width = width;
            style.min_size.width = min_width;
        }
        if collapsed_border.is_some() {
            self.doc.nodes[dom_id].style_mut().border = own_border;
        }
        output
    }
}

/// Whether a cell's content is wrapping text that `overflow-wrap` may break
/// at any width. Replaced elements, form controls, authored widths and
/// unwrappable text keep their min-content width, so they still widen the
/// table rather than paint over neighbouring cells. Nested tables qualify
/// when their own cells do: they relax the same way once given a width.
fn wraps_text_only(doc: &BaseDocument, node_id: NodeId) -> bool {
    use style::values::computed::OverflowWrap;
    use style::computed_values::text_wrap_mode::T as TextWrapMode;

    let node = &doc.nodes[node_id];
    if node.is_text_node() {
        return true;
    }
    if let Some(element) = node.element_data() {
        if matches!(
            element.name.local,
            local_name!("img")
                | local_name!("svg")
                | local_name!("video")
                | local_name!("canvas")
                | local_name!("iframe")
                | local_name!("object")
                | local_name!("embed")
                | local_name!("input")
                | local_name!("textarea")
                | local_name!("select")
                | local_name!("button")
                | local_name!("math")
        ) {
            return false;
        }
        let style = node.style();
        if style.size.width.tag() == taffy::CompactLength::LENGTH_TAG
            || style.min_size.width.into_raw().tag() == taffy::CompactLength::LENGTH_TAG
        {
            return false;
        }
        let Some(styles) = node.primary_styles() else {
            return false;
        };
        if styles.clone_overflow_wrap() == OverflowWrap::Normal
            || styles.clone_text_wrap_mode() != TextWrapMode::Wrap
        {
            return false;
        }
    }
    node.children
        .iter()
        .all(|&child| wraps_text_only(doc, child))
}

impl TableTreeWrapper<'_> {
    /// The border-box width the last layout's columns need, when the table
    /// uses auto layout. Fixed layout honours the authored width instead.
    pub(crate) fn required_width(&self) -> Option<f32> {
        if self.ctx.is_fixed {
            return None;
        }
        let info = self.ctx.computed_grid_info.borrow();
        let positions = &info.as_ref()?.columns.positions;
        let start = positions.iter().map(|line| line.start).reduce(f32::min)?;
        let end = positions.iter().map(|line| line.end).reduce(f32::max)?;
        let padding = self.ctx.style.padding.resolve_or_zero(None, resolve_calc_value);
        let border = self.ctx.style.border.resolve_or_zero(None, resolve_calc_value);
        let leading = (start - padding.left - border.left).min(0.0);
        Some(end + padding.right + border.right - leading)
    }

    /// The border-box height a cell needs for its content at `width`,
    /// ignoring an authored height, which only sets the row's minimum.
    fn cell_content_height(
        &mut self,
        dom_id: NodeId,
        width: f32,
        inputs: &taffy::tree::LayoutInput,
    ) -> f32 {
        let measure = taffy::tree::LayoutInput {
            run_mode: taffy::RunMode::ComputeSize,
            sizing_mode: taffy::SizingMode::InherentSize,
            axis: taffy::RequestedAxis::Vertical,
            known_dimensions: taffy::Size {
                width: Some(width),
                height: None,
            },
            vertical_margins_are_collapsible: taffy::Line::FALSE,
            ..*inputs
        };
        let node_id = crate::taffy_node_id(dom_id);
        let style = self.doc.nodes[dom_id].style();
        let (height, min_height) = (style.size.height, style.min_size.height);
        if height.is_auto() && min_height.is_auto() {
            // Usually a cache hit from row sizing.
            return self.doc.compute_child_layout(node_id, measure).size.height;
        }

        // Measuring without the authored height must not leave that result in
        // the cell's cache, where it would answer later row-sizing queries.
        let node = &mut self.doc.nodes[dom_id];
        node.cache_mut().clear();
        node.style_mut().size.height = style_helpers::auto();
        node.style_mut().min_size.height = style_helpers::auto();
        let content_height = self.doc.compute_child_layout(node_id, measure).size.height;
        let node = &mut self.doc.nodes[dom_id];
        node.style_mut().size.height = height;
        node.style_mut().min_size.height = min_height;
        node.cache_mut().clear();
        content_height
    }
}

impl taffy::LayoutGridContainer for TableTreeWrapper<'_> {
    type GridContainerStyle<'a>
        = &'a taffy::Style<Atom>
    where
        Self: 'a;

    type GridItemStyle<'a>
        = &'a taffy::Style<Atom>
    where
        Self: 'a;

    fn get_grid_container_style(&self, node_id: taffy::NodeId) -> Self::GridContainerStyle<'_> {
        self.get_core_container_style(node_id)
    }

    fn get_grid_child_style(&self, child_node_id: taffy::NodeId) -> Self::GridItemStyle<'_> {
        &self.ctx.cells[usize::from(child_node_id)].style
    }

    fn set_detailed_grid_info(
        &mut self,
        _node_id: taffy::NodeId,
        detailed_grid_info: DetailedGridInfo<Atom>,
    ) {
        *self.ctx.computed_grid_info.borrow_mut() = Some(detailed_grid_info);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn candidate(width: f32, style: BorderStyle, origin: u8) -> BorderCandidate {
        BorderCandidate {
            width,
            style,
            color: AbsoluteColor::srgb_legacy(origin, 0, 0, 1.0),
            origin,
        }
    }

    #[test]
    fn collapsed_conflicts_follow_css_2_1() {
        // Hidden suppresses everything.
        assert_eq!(
            resolve_edge(&[
                candidate(5.0, BorderStyle::Solid, 4),
                candidate(1.0, BorderStyle::Hidden, 1)
            ]),
            None
        );
        // Wider wins, regardless of origin.
        let edge = resolve_edge(&[
            candidate(1.0, BorderStyle::Solid, 4),
            candidate(3.0, BorderStyle::Solid, 1),
        ])
        .unwrap();
        assert_eq!(edge.width, 3.0);
        // Then style: double beats solid beats dashed.
        let edge = resolve_edge(&[
            candidate(2.0, BorderStyle::Dashed, 4),
            candidate(2.0, BorderStyle::Double, 1),
        ])
        .unwrap();
        assert_eq!(edge.style, BorderStyle::Double);
        // Then origin: the cell beats the row and the table.
        let edge = resolve_edge(&[
            candidate(1.0, BorderStyle::Solid, 1),
            candidate(1.0, BorderStyle::Solid, 4),
            candidate(1.0, BorderStyle::Solid, 3),
        ])
        .unwrap();
        assert_eq!(edge.color, AbsoluteColor::srgb_legacy(4, 0, 0, 1.0));
        // `none` never paints.
        assert_eq!(resolve_edge(&[candidate(3.0, BorderStyle::None, 4)]), None);
    }

    #[test]
    fn odd_widths_keep_whole_pixels_after_the_line() {
        let edge = |width| CollapsedEdge {
            width,
            style: BorderStyle::Solid,
            color: AbsoluteColor::BLACK,
        };
        assert_eq!((edge(1.0).before(), edge(1.0).after()), (0.0, 1.0));
        assert_eq!((edge(2.0).before(), edge(2.0).after()), (1.0, 1.0));
        assert_eq!((edge(3.0).before(), edge(3.0).after()), (1.0, 2.0));
    }
}
