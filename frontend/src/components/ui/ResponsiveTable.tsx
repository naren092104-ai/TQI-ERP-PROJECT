import React from "react";

/**
 * ResponsiveTable — renders a table on desktop and stacked cards on mobile.
 *
 * Usage:
 *   <ResponsiveTable
 *     items={rows}
 *     getKey={(r) => r.id}
 *     renderTable={() => <table className="tqi-table">...</table>}
 *     renderCard={(r) => (
 *       <ResponsiveTable.Card>
 *         <ResponsiveTable.CardHead>
 *           <ResponsiveTable.CardTitle>{r.name}</ResponsiveTable.CardTitle>
 *           <StatusChip value={r.status} />
 *         </ResponsiveTable.CardHead>
 *         <ResponsiveTable.CardRow label="Cluster" value={r.cluster} />
 *         <ResponsiveTable.CardRow label="Updated" value={r.updatedAt} />
 *         <ResponsiveTable.CardActions>
 *           <button>Edit</button>
 *         </ResponsiveTable.CardActions>
 *       </ResponsiveTable.Card>
 *     )}
 *   />
 */

interface ResponsiveTableProps<T> {
  items: T[];
  getKey: (item: T) => string | number;
  renderTable: () => React.ReactNode;
  renderCard: (item: T) => React.ReactNode;
  emptyState?: React.ReactNode;
  /** Force table or cards regardless of viewport. */
  force?: "table" | "cards";
  /** Class name for the outer wrapper. */
  className?: string;
}

export function ResponsiveTable<T>({
  items,
  getKey,
  renderTable,
  renderCard,
  emptyState,
  force,
  className = "",
}: ResponsiveTableProps<T>) {
  if (items.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div className={className}>
      <div
        className="tqi-rtable-table"
        style={force === "cards" ? { display: "none" } : undefined}
      >
        {renderTable()}
      </div>
      <div
        className="tqi-rtable-cards"
        style={force === "table" ? { display: "none" } : undefined}
      >
        {items.map((item) => (
          <React.Fragment key={getKey(item)}>{renderCard(item)}</React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ============== Subcomponents ==============

const Card: React.FC<React.PropsWithChildren<{ onClick?: () => void }>> = ({
  children,
  onClick,
}) => (
  <div
    className="tqi-rtable-card"
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
  >
    {children}
  </div>
);

const CardHead: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="tqi-rtable-card-head">{children}</div>
);

const CardTitle: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="tqi-rtable-card-title">{children}</div>
);

const CardRow: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="tqi-rtable-card-row">
    <span className="label">{label}</span>
    <span style={{ textAlign: "right", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
      {value}
    </span>
  </div>
);

const CardActions: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="tqi-rtable-card-actions">{children}</div>
);

ResponsiveTable.Card = Card;
ResponsiveTable.CardHead = CardHead;
ResponsiveTable.CardTitle = CardTitle;
ResponsiveTable.CardRow = CardRow;
ResponsiveTable.CardActions = CardActions;

export default ResponsiveTable;
