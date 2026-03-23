'use client';

import * as React from 'react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type Column,
  type Header,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
  type ColumnOrderState,
} from '@tanstack/react-table';

export type { Column } from '@tanstack/react-table';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  GripVertical,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 컬럼 메타데이터 타입 정의
 *
 * - headerSort: true → 정렬 가능한 헤더 버튼으로 렌더링
 * - headerAlign: "left" | "center" | "right" → 헤더 정렬
 * - cellAlign: "left" | "center" | "right" → 셀 정렬
 * - enableSorting: boolean → 컬럼 정렬 기능 (기본값: true)
 * - enableHiding: boolean → 컬럼 숨기기 기능 (기본값: true)
 * - rowClickable: boolean → row 클릭 시 onRowClick 동작 여부 (기본값: true)
 * - editable: boolean → 셀 편집 가능 여부 (기본값: false)
 * - editType: "text" | "number" | "select" | "date" → 편집 입력 타입
 * - selectOptions: { label: string; value: string }[] → select 타입일 때 옵션
 * - onCellEdit: (rowData, newValue) => boolean | Promise<boolean> → 셀 편집 검증
 */
export interface DataTableColumnMeta<TData = unknown> {
  headerSort?: boolean;
  headerAlign?: 'left' | 'center' | 'right';
  cellAlign?: 'left' | 'center' | 'right';
  enableSorting?: boolean;
  enableHiding?: boolean;
  rowClickable?: boolean;
  editable?: boolean;
  editType?: 'text' | 'number' | 'select' | 'date';
  selectOptions?: { label: string; value: string }[];
  onCellEdit?: (rowData: TData, newValue: unknown) => boolean | Promise<boolean>;
}

// EditableCell 컴포넌트
interface EditableCellProps<TData> {
  value: unknown;
  rowData: TData;
  columnId: string;
  meta?: DataTableColumnMeta<TData>;
  onSave: (columnId: string, newValue: unknown) => void;
}

function EditableCell<TData>({ value, rowData, columnId, meta, onSave }: EditableCellProps<TData>) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value);
  const [isLoading, setIsLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const selectRef = React.useRef<HTMLSelectElement>(null);

  const editType = meta?.editType || 'text';
  const selectOptions = meta?.selectOptions || [];

  const handleStartEdit = () => {
    if (!meta?.editable) return;
    setIsEditing(true);
    setEditValue(value);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value);
  };

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    if (meta?.onCellEdit) {
      setIsLoading(true);
      try {
        const isValid = await meta.onCellEdit(rowData, editValue);
        if (!isValid) {
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error('Cell edit validation failed:', error);
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }

    onSave(columnId, editValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = () => {
    if (isEditing) {
      handleSave();
    }
  };

  React.useEffect(() => {
    if (isEditing) {
      if (editType === 'select' && selectRef.current) {
        selectRef.current.focus();
      } else if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [isEditing, editType]);

  if (!meta?.editable) {
    return <div>{String(value ?? '')}</div>;
  }

  if (isEditing) {
    if (editType === 'select') {
      return (
        <select
          ref={selectRef}
          value={String(editValue ?? '')}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {selectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (editType === 'date') {
      return (
        <input
          ref={inputRef}
          type="date"
          value={String(editValue ?? '')}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      );
    }

    return (
      <input
        ref={inputRef}
        type={editType}
        value={String(editValue ?? '')}
        onChange={(e) => {
          const newValue = editType === 'number' ? parseFloat(e.target.value) : e.target.value;
          setEditValue(newValue);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  }

  return (
    <div
      onDoubleClick={handleStartEdit}
      className="cursor-pointer hover:bg-muted/30 px-2 py-1 rounded min-h-[32px] flex items-center"
      title="더블클릭하여 편집"
    >
      {String(value ?? '')}
    </div>
  );
}

// DnD용 TableHead 컴포넌트
function DraggableTableHeader<TData>({
  header,
  isDraggable,
}: {
  header: Header<TData, unknown>;
  isDraggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.column.id,
  });

  const isSelectColumn = header.column.id === 'select';
  const showDragHandle = isDraggable && !isSelectColumn;

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: 'relative',
    transform: CSS.Translate.toString(transform),
    transition,
    whiteSpace: 'nowrap',
    width: header.column.getSize(),
    zIndex: isDragging ? 1 : 0,
  };

  const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;
  const headerAlignClass =
    meta?.headerAlign === 'left'
      ? 'text-left'
      : meta?.headerAlign === 'right'
        ? 'text-right'
        : 'text-center';

  return (
    <TableHead
      key={header.id}
      colSpan={header.colSpan}
      ref={setNodeRef}
      style={style}
      className={headerAlignClass}
      suppressHydrationWarning
    >
      {header.isPlaceholder ? null : (
        <div className="flex items-center gap-[5px]">
          {showDragHandle && (
            <button
              type="button"
              className="cursor-grab active:cursor-grabbing flex-shrink-0"
              {...attributes}
              {...listeners}
              suppressHydrationWarning
            >
              <GripVertical className="h-4 w-4 text-gray-400" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </div>
        </div>
      )}
    </TableHead>
  );
}

// 정렬 가능한 헤더 헬퍼
export function createSortableHeader<TData>(
  column: Column<TData, unknown>,
  label: string,
  align?: 'left' | 'center' | 'right',
) {
  const effectiveAlign = align ?? 'center';
  const alignClass =
    effectiveAlign === 'right'
      ? 'justify-end'
      : effectiveAlign === 'center'
        ? 'justify-center'
        : '';

  if (!column.getCanSort()) {
    return <div className={`flex items-center ${alignClass}`}>{label}</div>;
  }

  const sortState = column.getIsSorted();

  const handleSort = () => {
    if (sortState === false) {
      column.toggleSorting(false);
    } else if (sortState === 'asc') {
      column.toggleSorting(true);
    } else {
      column.clearSorting();
    }
  };

  const SortIcon = sortState === 'asc' ? ArrowUp : sortState === 'desc' ? ArrowDown : ArrowUpDown;

  return (
    <Button variant="ghost" onClick={handleSort} className={alignClass}>
      {label}
      <SortIcon className="ml-2 h-4 w-4" />
    </Button>
  );
}

// 체크박스 컬럼 헬퍼
export function createSelectColumn<TData>(): ColumnDef<TData> {
  return {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
    meta: {
      rowClickable: false,
    },
  };
}

// 컬럼 정의 헬퍼
export function createColumnHelper<TData>() {
  return {
    accessor: <TValue = unknown,>(
      accessorKey: keyof TData & string,
      {
        header,
        cell,
        meta,
        ...rest
      }: Omit<ColumnDef<TData, TValue>, 'accessorKey'> & {
        meta?: DataTableColumnMeta;
      },
    ): ColumnDef<TData, TValue> => {
      return {
        accessorKey,
        header: meta?.headerSort
          ? ({ column }) => createSortableHeader(column, header as string, meta?.headerAlign)
          : header,
        cell,
        enableSorting: meta?.enableSorting ?? true,
        enableHiding: meta?.enableHiding ?? true,
        meta,
        ...rest,
      };
    },
    display: <TValue = unknown,>({
      id,
      header,
      cell,
      meta,
      ...rest
    }: Omit<ColumnDef<TData, TValue>, 'accessorKey'> & {
      id: string;
      meta?: DataTableColumnMeta;
    }): ColumnDef<TData, TValue> => {
      return {
        id,
        header: meta?.headerSort
          ? ({ column }) => createSortableHeader(column, header as string, meta?.headerAlign)
          : header,
        cell,
        enableSorting: meta?.enableSorting ?? false,
        enableHiding: meta?.enableHiding ?? true,
        meta,
        ...rest,
      };
    },
  };
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  showColumnVisibility?: boolean;
  selectable?: boolean;
  enableColumnDnd?: boolean;
  enableFullscreen?: boolean;
  enableScroll?: boolean;
  maxHeight?: string;
  enableSorting?: boolean;
  enableVirtualization?: boolean;
  estimateSize?: number;
  onSelectionChange?: (selectedRows: TData[]) => void;
  onColumnOrderChange?: (columnOrder: string[]) => void;
  onRowClick?: (row: TData) => void;
  onDataChange?: (updatedData: TData[]) => void;
  loading?: boolean;
  loadingRows?: number;
  emptyMessage?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data: initialData,
  showColumnVisibility = true,
  selectable = true,
  enableColumnDnd = true,
  enableFullscreen = true,
  enableScroll = true,
  maxHeight = '800px',
  enableSorting = true,
  enableVirtualization = true,
  estimateSize = 50,
  onSelectionChange,
  onColumnOrderChange,
  onRowClick,
  onDataChange,
  loading = false,
  loadingRows = 5,
  emptyMessage = '데이터가 없습니다.',
}: DataTableProps<TData, TValue>) {
  const [internalData, setInternalData] = React.useState<TData[]>(initialData);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([]);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const tableBodyRef = React.useRef<HTMLTableSectionElement>(null);

  const onSelectionChangeRef = React.useRef(onSelectionChange);
  const onColumnOrderChangeRef = React.useRef(onColumnOrderChange);

  React.useEffect(() => {
    setInternalData(initialData);
  }, [initialData]);

  React.useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
    onColumnOrderChangeRef.current = onColumnOrderChange;
  });

  const finalColumns = React.useMemo(() => {
    if (selectable) {
      const hasSelectColumn = columns.some((col) => col.id === 'select');
      if (!hasSelectColumn) {
        return [createSelectColumn<TData>(), ...columns];
      }
    }
    return columns;
  }, [columns, selectable]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: internalData,
    columns: finalColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    enableSorting,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnOrder,
    },
  });

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id && active.id !== 'select' && over.id !== 'select') {
      const oldIndex = columnOrder.indexOf(active.id as string);
      const newIndex = columnOrder.indexOf(over.id as string);
      let newColumnOrder = arrayMove(columnOrder, oldIndex, newIndex);

      if (newColumnOrder.includes('select')) {
        newColumnOrder = ['select', ...newColumnOrder.filter((id) => id !== 'select')];
      }

      setColumnOrder(newColumnOrder);

      if (onColumnOrderChangeRef.current) {
        const orderableColumns = newColumnOrder.filter((id) => id !== 'select');
        onColumnOrderChangeRef.current(orderableColumns);
      }
    }
  }

  React.useEffect(() => {
    const columnIds = finalColumns
      .map((col) => {
        if ('id' in col && col.id) return col.id;
        if ('accessorKey' in col && col.accessorKey) return String(col.accessorKey);
        return '';
      })
      .filter(Boolean);

    const currentHasSelect = columnOrder.includes('select');
    const shouldHaveSelect = columnIds.includes('select');

    if (
      columnOrder.length === 0 ||
      currentHasSelect !== shouldHaveSelect ||
      columnIds.length !== columnOrder.length
    ) {
      setColumnOrder(columnIds);
    }
  }, [columnOrder, finalColumns, selectable]);

  React.useEffect(() => {
    if (selectable && onSelectionChangeRef.current) {
      const selectedRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
      onSelectionChangeRef.current(selectedRows);
    }
  }, [rowSelection, selectable, table]);

  const handleCellSave = React.useCallback(
    (rowIndex: number, columnId: string, newValue: unknown) => {
      const updatedData = [...internalData];
      const rowData = updatedData[rowIndex] as Record<string, unknown>;
      rowData[columnId] = newValue;
      setInternalData(updatedData);
      onDataChange?.(updatedData);
    },
    [internalData, onDataChange],
  );

  const { rows } = table.getRowModel();

  const [visibleRange, setVisibleRange] = React.useState({ start: 0, end: 50 });

  React.useEffect(() => {
    if (!enableVirtualization) {
      return undefined;
    }

    const handleScroll = () => {
      const scrollTop = enableScroll ? tableContainerRef.current?.scrollTop || 0 : window.scrollY;

      const containerTop = enableScroll
        ? 0
        : (tableContainerRef.current?.getBoundingClientRect().top || 0) + window.scrollY;

      const viewportHeight = enableScroll
        ? tableContainerRef.current?.clientHeight || 0
        : window.innerHeight;

      const scrollOffset = enableScroll ? scrollTop : Math.max(0, scrollTop - containerTop);
      const startIndex = Math.max(0, Math.floor(scrollOffset / estimateSize) - 10);
      const endIndex = Math.min(
        rows.length,
        Math.ceil((scrollOffset + viewportHeight) / estimateSize) + 10,
      );

      setVisibleRange({ start: startIndex, end: endIndex });
    };

    handleScroll();

    const scrollTarget = enableScroll ? tableContainerRef.current : window;
    scrollTarget?.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);

    return () => {
      scrollTarget?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [enableVirtualization, enableScroll, rows.length, estimateSize]);

  const virtualizedRows = enableVirtualization
    ? rows.slice(visibleRange.start, visibleRange.end)
    : rows;

  const paddingTop = enableVirtualization ? visibleRange.start * estimateSize : 0;
  const paddingBottom = enableVirtualization ? (rows.length - visibleRange.end) * estimateSize : 0;

  // 행 렌더링 함수 (가상화/비가상화 공통)
  const renderRow = (row: (typeof rows)[number]) => (
    <TableRow
      key={row.id}
      data-state={row.getIsSelected() && 'selected'}
      className={onRowClick ? 'hover:bg-muted/50 cursor-pointer' : 'hover:bg-transparent'}
    >
      {row.getVisibleCells().map((cell) => {
        const meta = cell.column.columnDef.meta as DataTableColumnMeta<TData>;
        const isRowClickable = meta?.rowClickable !== false;
        const isEditable = meta?.editable === true;

        const cellAlignClass =
          meta?.cellAlign === 'left'
            ? 'justify-start'
            : meta?.cellAlign === 'right'
              ? 'justify-end'
              : 'justify-center';

        return (
          <TableCell
            key={cell.id}
            onClick={
              onRowClick && isRowClickable && !isEditable
                ? () => onRowClick(row.original)
                : undefined
            }
          >
            <div className={`flex items-center ${cellAlignClass}`}>
              {isEditable ? (
                <EditableCell<TData>
                  value={cell.getValue()}
                  rowData={row.original}
                  columnId={cell.column.id}
                  meta={meta}
                  onSave={(columnId, newValue) => handleCellSave(row.index, columnId, newValue)}
                />
              ) : (
                flexRender(cell.column.columnDef.cell, cell.getContext())
              )}
            </div>
          </TableCell>
        );
      })}
    </TableRow>
  );

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-background p-6 flex flex-col' : 'w-full'}>
      {(showColumnVisibility || enableFullscreen) && (
        <div className="flex items-center py-4">
          {showColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto">
                  Columns <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {enableFullscreen && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={showColumnVisibility ? 'ml-2' : 'ml-auto'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}
        </div>
      )}
      <div
        className={
          isFullscreen
            ? 'flex-1 rounded-md border overflow-hidden flex flex-col'
            : 'rounded-md border overflow-hidden'
        }
      >
        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={(event: DragEndEvent) => handleDragEnd(event)}
          sensors={sensors}
        >
          <div
            ref={tableContainerRef}
            className={
              isFullscreen
                ? 'overflow-auto relative flex-1'
                : enableScroll
                  ? 'overflow-auto relative'
                  : 'overflow-hidden'
            }
            style={enableScroll && maxHeight && !isFullscreen ? { maxHeight } : undefined}
          >
            <table className="w-full caption-bottom text-sm">
              <TableHeader
                className={
                  enableScroll || isFullscreen ? 'sticky top-0 z-10 bg-background border-b' : ''
                }
              >
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                      {headerGroup.headers.map((header) => (
                        <DraggableTableHeader<TData>
                          key={header.id}
                          header={header}
                          isDraggable={enableColumnDnd}
                        />
                      ))}
                    </SortableContext>
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody ref={tableBodyRef}>
                {loading ? (
                  <>
                    {Array.from({ length: loadingRows }).map((_, rowIndex) => (
                      <TableRow key={`skeleton-${rowIndex}`} className="hover:bg-transparent">
                        {table.getAllColumns().map((column, colIndex) => (
                          <TableCell key={`skeleton-${rowIndex}-${colIndex}`}>
                            {column.id === 'select' ? (
                              <Skeleton className="h-4 w-4 rounded-sm" />
                            ) : (
                              <div className="flex justify-center">
                                <Skeleton
                                  className="h-4"
                                  style={{
                                    width: `${[60, 75, 50, 85, 65, 70, 55, 80, 90, 45][colIndex % 10]}%`,
                                  }}
                                />
                              </div>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </>
                ) : rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={table.getAllColumns().length} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <p className="text-muted-foreground">{emptyMessage}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : enableVirtualization ? (
                  <>
                    {paddingTop > 0 && (
                      <tr>
                        <td
                          colSpan={table.getAllColumns().length}
                          style={{ height: `${paddingTop}px` }}
                          aria-hidden="true"
                        />
                      </tr>
                    )}
                    {virtualizedRows.map(renderRow)}
                    {paddingBottom > 0 && (
                      <tr>
                        <td
                          colSpan={table.getAllColumns().length}
                          style={{ height: `${paddingBottom}px` }}
                          aria-hidden="true"
                        />
                      </tr>
                    )}
                  </>
                ) : (
                  rows.map(renderRow)
                )}
              </TableBody>
            </table>
          </div>
        </DndContext>
      </div>
    </div>
  );
}
