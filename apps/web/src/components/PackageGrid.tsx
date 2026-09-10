'use client';

import Link from 'next/link';
import { Shape, type ShapeName } from './Brand';
import { useLocale } from './LocaleProvider';

export interface Tile {
  packageId: string;
  zoneId: string;
  zoneName: string;
  zoneNameAr: string | null;
  supervisionMode: 'accompanied' | 'drop_off';
  minutes: number;
}

/** The zone's name in the reader's language, falling back to the English. */
export function zoneLabel(tile: { zoneName: string; zoneNameAr: string | null }, locale: string): string {
  return locale === 'ar' ? tile.zoneNameAr ?? tile.zoneName : tile.zoneName;
}

/**
 * The tile grid from the brand sheet, doing a job: zero gutter, flat colour
 * fields, one motif per tile at roughly 60-70% of the tile width, centred.
 *
 * Tiles are grouped by zone rather than interleaved. A parent is choosing a
 * *place* first and a length second — mixing the two zones down one column made
 * them compare "15 Soft Play" against "15 Bouncy" when the real question is
 * which zone their child is old enough for. Each zone gets a heading and its
 * own run of tiles, and the ground cycle continues across the groups so no two
 * tiles of the same colour ever touch.
 */
const GROUNDS = ['ground-indigo', 'ground-yellow', 'ground-pink', 'ground-orange', 'ground-sky'] as const;
const SHAPES: ShapeName[] = ['star', 'clover', 'asterisk', 'arch', 'sunburst'];

export interface ZoneGroup {
  zoneId: string;
  zoneName: string;
  zoneNameAr: string | null;
  supervisionMode: 'accompanied' | 'drop_off';
  tiles: Tile[];
}

export function groupByZone(tiles: Tile[]): ZoneGroup[] {
  const groups: ZoneGroup[] = [];
  for (const tile of tiles) {
    let group = groups.find((g) => g.zoneId === tile.zoneId);
    if (!group) {
      group = {
        zoneId: tile.zoneId,
        zoneName: tile.zoneName,
        zoneNameAr: tile.zoneNameAr,
        supervisionMode: tile.supervisionMode,
        tiles: [],
      };
      groups.push(group);
    }
    group.tiles.push(tile);
  }
  return groups;
}

export function PackageGrid({ tiles, hrefBase, onSelect, selectedId }: {
  tiles: Tile[];
  hrefBase?: string;
  onSelect?: (tile: Tile) => void;
  selectedId?: string | null;
}) {
  const { t, n, locale } = useLocale();
  const groups = groupByZone(tiles);
  let index = -1;

  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <section key={group.zoneId}>
          <div className="px-6 pt-6 pb-3">
            <h2 className="display" style={{ fontSize: 'var(--font-size-2xl)' }}>{zoneLabel(group, locale)}</h2>
            <p className="text-sm muted mt-1">{t.landing.zoneNote[group.supervisionMode]}</p>
          </div>

          {/*
            The grid carries the next ground in the cycle as its own background.
            The tile count per zone rarely divides by the column count, and the
            source sheet is explicit that "some tiles are deliberately left empty
            as flat colour" — so the leftover reads as an empty tile rather than
            a hole in the field. Breakpoint-proof, because it does not depend on
            knowing how many columns there are.
          */}
          <div className={`tile-grid ${GROUNDS[(index + 1) % GROUNDS.length]}`}>
            {group.tiles.map((tile) => {
              index += 1;
              const className = `tile ${GROUNDS[index % GROUNDS.length]}`;
              // The supervision note sits on the group heading, not on every
              // tile — repeating it five times made the grid read as five
              // different warnings rather than two zones. The tile is now one
              // number and a tap target the size of a thumb.
              const body = (
                <>
                  <Shape name={SHAPES[index % SHAPES.length]!} size="66%" className="tile-shape" />
                  <div className="relative flex-1 flex items-center">
                    <div className="display" style={{ fontSize: 'var(--font-size-4xl)', color: 'inherit' }}>
                      {n(tile.minutes)}
                      <span className="display" style={{ fontSize: 'var(--font-size-xl)', color: 'inherit' }}>
                        {' '}{t.common.min}
                      </span>
                    </div>
                  </div>
                </>
              );

              if (onSelect) {
                return (
                  <button
                    key={tile.packageId}
                    type="button"
                    className={className}
                    data-selected={selectedId === tile.packageId}
                    aria-pressed={selectedId === tile.packageId}
                    onClick={() => onSelect(tile)}
                  >
                    {body}
                  </button>
                );
              }

              return (
                <Link key={tile.packageId} href={`${hrefBase ?? '#'}${tile.packageId}`} className={className}>
                  {body}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
