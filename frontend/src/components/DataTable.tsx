import React from 'react';
import { Link } from 'react-router-dom';

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowLink?: (row: T) => string;
}

function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  emptyMessage = '暂无数据',
  onRowClick,
  rowLink,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="card p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-gray-500">加载中...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-gray-400 text-5xl mb-4">📭</div>
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  const renderCell = (row: T, column: Column<T>) => {
    if (column.render) {
      return column.render(row);
    }
    const value = row[column.key as keyof T];
    return value?.toString() || '-';
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key as string}
                  className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  style={{ width: column.width }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.map((row) => {
              const RowWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
                if (rowLink) {
                  return (
                    <tr className="hover:bg-gray-50 cursor-pointer transition-colors">
                      <td colSpan={columns.length} className="p-0">
                        <Link to={rowLink(row)} className="block">
                          <table className="w-full">
                            <tbody>
                              <tr>{children}</tr>
                            </tbody>
                          </table>
                        </Link>
                      </td>
                    </tr>
                  );
                }
                if (onRowClick) {
                  return (
                    <tr
                      onClick={() => onRowClick(row)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      {children}
                    </tr>
                  );
                }
                return <tr className="hover:bg-gray-50 transition-colors">{children}</tr>;
              };

              return (
                <RowWrapper key={row.id}>
                  {columns.map((column) => (
                    <td key={column.key as string} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {renderCell(row, column)}
                    </td>
                  ))}
                </RowWrapper>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
