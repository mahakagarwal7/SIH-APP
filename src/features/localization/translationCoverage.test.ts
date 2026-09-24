import fs from 'node:fs';
import path from 'node:path';

import * as ts from 'typescript';

import { hiTranslations } from './translations';

const visibleProps = new Set([
  'title',
  'eyebrow',
  'label',
  'accessibilityLabel',
  'placeholder',
]);
const visibleProperties = new Set(['label', 'status', 'detail', 'message']);
const visibleCalls = new Set(['setMessage', 'setError', 'alert']);

function productionFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'localization' ? [] : productionFiles(target);
    }
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)
      ? [target]
      : [];
  });
}

function candidate(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (
    !/[A-Za-z]/.test(normalized) ||
    /^[/#]/.test(normalized) ||
    /^[a-z][a-z_-]*$/.test(normalized) ||
    /^https?:/.test(normalized) ||
    normalized === 'Nirmaan.'
  ) {
    return null;
  }
  return normalized;
}

function visibleCopy() {
  const values = new Set<string>();
  const add = (value: string) => {
    const normalized = candidate(value);
    if (normalized) values.add(normalized);
  };
  const addLiterals = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      add(node.text);
    }
    ts.forEachChild(node, addLiterals);
  };

  const roots = [
    path.join(process.cwd(), 'app'),
    path.join(process.cwd(), 'src', 'features'),
  ];
  for (const file of roots.flatMap(productionFiles)) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node)) add(node.text);
      if (
        ts.isJsxAttribute(node) &&
        visibleProps.has(node.name.getText(source))
      ) {
        if (node.initializer && ts.isStringLiteral(node.initializer)) {
          add(node.initializer.text);
        } else if (
          node.initializer &&
          ts.isJsxExpression(node.initializer) &&
          node.initializer.expression
        ) {
          addLiterals(node.initializer.expression);
        }
      }
      if (ts.isJsxExpression(node) && node.expression)
        addLiterals(node.expression);
      if (ts.isCallExpression(node)) {
        const name = ts.isIdentifier(node.expression)
          ? node.expression.text
          : ts.isPropertyAccessExpression(node.expression)
            ? node.expression.name.text
            : '';
        if (visibleCalls.has(name)) node.arguments.forEach(addLiterals);
      }
      if (
        ts.isPropertyAssignment(node) &&
        ts.isIdentifier(node.name) &&
        visibleProperties.has(node.name.text)
      ) {
        addLiterals(node.initializer);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return [...values];
}

it('has non-empty Hindi copy for every visible static English phrase', () => {
  const missing = visibleCopy().filter((source) => !hiTranslations[source]);
  expect(missing).toEqual([]);
});

it('contains Devanagari for translated prose', () => {
  const invalid = Object.entries(hiTranslations)
    .filter(
      ([source]) =>
        /[A-Za-z]{3}/.test(source) &&
        !/^[_A-Z]+$/.test(source) &&
        !/^(SHA-256|YYYY-MM-DD)$/.test(source),
    )
    .filter(([, translated]) => !/[\u0900-\u097f]/.test(translated));
  expect(invalid).toEqual([]);
});
