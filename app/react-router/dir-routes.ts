import { readdirSync, statSync } from "node:fs";
import { join, parse, resolve, relative, posix } from "node:path";
import { route, layout, getAppDirectory, type RouteConfigEntry } from "@react-router/dev/routes";
import { type RouteConfig } from "@react-router/dev/routes";

export type Options = {
  rootDir?: string;
  layout?: string;
  index?: string;
  extensions?: string[];
};

const defaultOptions: Required<Options> = {
  rootDir: "routes",
  layout: "_layout",
  index: "_index",
  extensions: [".tsx", ".ts", ".jsx", ".js"],
};

export function dirRoutes(options?: Options): RouteConfig {
  const opts: Required<Options> = { ...defaultOptions, ...options };
  const appDir = getAppDirectory();
  const rootDir = resolve(appDir, opts.rootDir);

  const routes = scanDirectory(rootDir, "", opts);

  printRouteTree(routes);
  return routes as unknown as RouteConfig;
}

function scanDirectory(dir: string, parentPath: string = "", options: Required<Options>, isInsideTypesDir: boolean = false): RouteConfigEntry[] {
  const routes: RouteConfigEntry[] = [];
  const { files } = scanDir(dir, options);
  const layoutFile = findSpecialFile(files, options.layout, options);
  const indexFile = findSpecialFile(files, options.index, options);
  const currentLevelRoutes: RouteConfigEntry[] = [];

  if (indexFile) {
    const fullPath = join(dir, indexFile);
    if (parentPath) {
      const routePath = parentPath.startsWith("/")
        ? parentPath
        : `/${parentPath}`;
      const routeEntry = route(
        routePath,
        relative(options.rootDir, fullPath)
      );
      (layoutFile ? currentLevelRoutes : routes).push(routeEntry);
    } else {
      const routeEntry: RouteConfigEntry = {
        index: true,
        file: relative(options.rootDir, fullPath),
      };
      (layoutFile ? currentLevelRoutes : routes).push(routeEntry);
    }
  }

  files.forEach((item) => {
    const fullPath = join(dir, item);
    const stats = statSync(fullPath);
    const { name, ext, base } = parse(item);

    if (name === options.layout || name === options.index || (name.startsWith("_") && name !== options.layout && name !== options.index)) {
      return;
    }

    if (stats.isDirectory()) {
      const isGroupDir = base.startsWith("(") && base.endsWith(")");
      const nextParentPath = isGroupDir ? parentPath : parentPath ? `${parentPath}/${base}` : base;
      const nestedRoutes = scanDirectory(fullPath, nextParentPath, options, isInsideTypesDir);

      (layoutFile ? currentLevelRoutes : routes).push(...nestedRoutes);
    } else if (options.extensions.includes(ext)) {
      const routePath = createRoutePath(name, parentPath);
      const routeEntry = route(routePath, relative(options.rootDir, fullPath));

      (layoutFile ? currentLevelRoutes : routes).push(routeEntry);
    }
  });

  if (layoutFile) {
    const layoutPath = relative(options.rootDir, join(dir, layoutFile));
    routes.push(layout(layoutPath, currentLevelRoutes));
  }

  return routes;
}

function scanDir(dirPath: string, options: Required<Options>): { files: string[]; dirName: string } {
  const dirName = parse(dirPath).base;
  const allFiles = readdirSync(dirPath);

  const sortedFiles = allFiles.sort((a, b) => {
    const { name: aName } = parse(a);
    const { name: bName } = parse(b);

    const aIsSpecial = aName === options.index || aName === options.layout;
    const bIsSpecial = bName === options.index || bName === options.layout;

    if (aIsSpecial && !bIsSpecial) return -1;
    if (!aIsSpecial && bIsSpecial) return 1;
    return a.localeCompare(b);
  });

  return { files: sortedFiles, dirName };
}

function findSpecialFile(files: string[], fileName: string, options: Required<Options>): string | undefined {
  return files.find((file) => {
    const { name, ext } = parse(file);
    return name === fileName && options.extensions.includes(ext);
  });
}

function createRoutePath(fileName: string, parentPath: string = ""): string {
  const rawSegments = fileName.split(".");
  const segments = rawSegments.map((segment) => (segment.startsWith("$") ? `:${segment.slice(1)}` : segment));

  let path = parentPath ? `${parentPath}/` : "/";
  path += segments.join("/");

  return path;
}

function printRouteTree(routes: RouteConfigEntry[], indent = 0): void {
  const indentStr = "  ".repeat(indent);
  for (const r of routes) {
    if (r.path) {
      console.log(`${indentStr}├── "${r.path}" (${r.file})`);
    } else if (r.index) {
      console.log(`${indentStr}├── (index) (${r.file})`);
    } else if (r.children) {
      console.log(`${indentStr}├── (layout) (${r.file})`);
      printRouteTree(r.children, indent + 1);
    }
  }
}
