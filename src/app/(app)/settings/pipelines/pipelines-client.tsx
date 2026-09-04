"use client";

import { useActionState } from "react";
import { ArrowUp, ArrowDown, Trash2, Star, Archive } from "lucide-react";

import { IDLE } from "@/lib/form";
import { STAGE_KIND_LABELS, STAGE_KINDS } from "@/lib/crm/labels";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton, FormError } from "@/components/form";
import {
  createPipelineAction,
  renamePipelineAction,
  setDefaultPipelineAction,
  archivePipelineAction,
  addStageAction,
  updateStageAction,
  deleteStageAction,
  reorderStageAction,
} from "./actions";

export type StageRow = {
  id: string;
  name: string;
  probability: number;
  kind: string;
  deals: number;
};

export type PipelineRow = {
  id: string;
  name: string;
  isDefault: boolean;
  archived: boolean;
  stages: StageRow[];
};

export function CreatePipeline() {
  const [state, action] = useActionState(createPipelineAction, IDLE);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px]">
        <label className="text-sm font-medium">Name</label>
        <Input name="name" required className="mt-1" placeholder="Enterprise pipeline" />
        {state.fieldErrors?.name && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.name}</p>
        )}
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" name="isDefault" /> Default
      </label>
      <SubmitButton size="sm" pendingText="Creating…">Create pipeline</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

export function PipelineCard({ pipeline }: { pipeline: PipelineRow }) {
  const [renameState, rename] = useActionState(renamePipelineAction, IDLE);
  const [addState, addStage] = useActionState(addStageAction, IDLE);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <form action={rename} className="flex items-center gap-2">
          <input type="hidden" name="id" value={pipeline.id} />
          <Input name="name" defaultValue={pipeline.name} className="h-8 w-52" />
          <SubmitButton size="sm" variant="outline" pendingText="…">Rename</SubmitButton>
        </form>
        {pipeline.isDefault ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <Star className="size-3" /> Default
          </span>
        ) : (
          <form action={setDefaultPipelineAction}>
            <input type="hidden" name="id" value={pipeline.id} />
            <button className="text-xs text-muted-foreground hover:text-foreground">
              Make default
            </button>
          </form>
        )}
        {!pipeline.isDefault && (
          <form action={archivePipelineAction}>
            <input type="hidden" name="id" value={pipeline.id} />
            <input type="hidden" name="archived" value={(!pipeline.archived).toString()} />
            <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Archive className="size-3" />
              {pipeline.archived ? "Unarchive" : "Archive"}
            </button>
          </form>
        )}
        {pipeline.archived && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Archived
          </span>
        )}
      </div>
      {renameState.error && <p className="mt-1 text-xs text-destructive">{renameState.error}</p>}

      <ul className="mt-3 divide-y divide-border border-y border-border">
        {pipeline.stages.map((s, i) => (
          <StageRowItem
            key={s.id}
            stage={s}
            first={i === 0}
            last={i === pipeline.stages.length - 1}
          />
        ))}
      </ul>

      <form action={addStage} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="pipelineId" value={pipeline.id} />
        <Input name="name" placeholder="New stage" required className="h-8 w-40" />
        <Input name="probability" placeholder="%" defaultValue="0" className="h-8 w-16" />
        <Select name="kind" defaultValue="OPEN" className="h-8 w-24">
          {STAGE_KINDS.map((k) => (
            <option key={k} value={k}>{STAGE_KIND_LABELS[k]}</option>
          ))}
        </Select>
        <SubmitButton size="sm" variant="outline" pendingText="…">Add stage</SubmitButton>
        <FormError message={addState.error} />
      </form>
    </div>
  );
}

function StageRowItem({
  stage,
  first,
  last,
}: {
  stage: StageRow;
  first: boolean;
  last: boolean;
}) {
  const [state, action] = useActionState(updateStageAction, IDLE);
  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="stageId" value={stage.id} />
        <input type="hidden" name="pipelineId" value="x" />
        <Input name="name" defaultValue={stage.name} className="h-8 w-40" />
        <Input
          name="probability"
          defaultValue={String(stage.probability)}
          className="h-8 w-16"
          aria-label="Probability"
        />
        <Select name="kind" defaultValue={stage.kind} className="h-8 w-24">
          {STAGE_KINDS.map((k) => (
            <option key={k} value={k}>{STAGE_KIND_LABELS[k]}</option>
          ))}
        </Select>
        <SubmitButton size="sm" variant="ghost" pendingText="…">Save</SubmitButton>
      </form>

      <span className="text-xs text-muted-foreground">{stage.deals} deal{stage.deals === 1 ? "" : "s"}</span>

      <div className="ml-auto flex items-center gap-1">
        {!first && (
          <form action={reorderStageAction}>
            <input type="hidden" name="stageId" value={stage.id} />
            <input type="hidden" name="direction" value="up" />
            <button className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Move up">
              <ArrowUp className="size-4" />
            </button>
          </form>
        )}
        {!last && (
          <form action={reorderStageAction}>
            <input type="hidden" name="stageId" value={stage.id} />
            <input type="hidden" name="direction" value="down" />
            <button className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Move down">
              <ArrowDown className="size-4" />
            </button>
          </form>
        )}
        <form
          action={deleteStageAction}
          onSubmit={(e) => {
            if (!confirm(`Delete stage "${stage.name}"? Deals move to another stage.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="stageId" value={stage.id} />
          <button className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Delete stage">
            <Trash2 className="size-4" />
          </button>
        </form>
      </div>
      {state.error && <p className="w-full text-xs text-destructive">{state.error}</p>}
    </li>
  );
}
