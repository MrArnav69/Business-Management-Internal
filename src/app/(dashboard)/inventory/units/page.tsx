'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Unit } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Search, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null)
  const [formName, setFormName] = useState('')
  const [formAbbreviation, setFormAbbreviation] = useState('')
  const [saving, setSaving] = useState(false)
  const [usedByProducts, setUsedByProducts] = useState(false)


  

  const fetchUnits = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      setUnits((data as any[]) || [])
    } catch (error) {
      console.error('Error fetching units:', error)
      toast.error('Failed to load units')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUnits()
  }, [fetchUnits])

  const openAddDialog = () => {
    setEditingUnit(null)
    setFormName('')
    setFormAbbreviation('')
    setDialogOpen(true)
  }

  const openEditDialog = (unit: Unit) => {
    setEditingUnit(unit)
    setFormName(unit.name)
    setFormAbbreviation(unit.abbreviation)
    setDialogOpen(true)
  }

  const openDeleteDialog = async (unit: Unit) => {
    setDeletingUnit(unit)
    try {
      const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('unit', unit.abbreviation)
      setUsedByProducts(count ? count > 0 : false)
    } catch {
      setUsedByProducts(false)
    }
    setDeleteDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Unit name is required')
      return
    }
    if (!formAbbreviation.trim()) {
      toast.error('Abbreviation is required')
      return
    }
    setSaving(true)
    try {
      if (editingUnit) {
        const { error } = await supabase
          .from('units')
          .update({ name: formName.trim(), abbreviation: formAbbreviation.trim() } as any)
          .eq('id', editingUnit.id)
        if (error) throw error
        toast.success('Unit updated successfully')
      } else {
        const { error } = await supabase
          .from('units')
          .insert({ name: formName.trim(), abbreviation: formAbbreviation.trim() } as any)
        if (error) throw error
        toast.success('Unit added successfully')
      }
      setDialogOpen(false)
      fetchUnits()
    } catch (error) {
      console.error('Error saving unit:', error)
      toast.error('Failed to save unit')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingUnit) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', deletingUnit.id)
      if (error) throw error
      toast.success('Unit deleted successfully')
      setDeleteDialogOpen(false)
      fetchUnits()
    } catch (error) {
      console.error('Error deleting unit:', error)
      toast.error('Failed to delete unit')
    } finally {
      setSaving(false)
    }
  }

  const filtered = units.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.abbreviation.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Units</h1>
          <p className="text-muted-foreground">Manage product units of measurement</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Unit
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search units..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Abbreviation</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No units found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium">{unit.name}</TableCell>
                  <TableCell>{unit.abbreviation}</TableCell>
                  <TableCell>{new Date(unit.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(unit)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(unit)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUnit ? 'Edit Unit' : 'Add Unit'}</DialogTitle>
            <DialogDescription>
              {editingUnit
                ? 'Update the unit details below.'
                : 'Fill in the details to add a new unit.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="unit-name">Unit Name</Label>
              <Input
                id="unit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Pieces"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-abbr">Abbreviation</Label>
              <Input
                id="unit-abbr"
                value={formAbbreviation}
                onChange={(e) => setFormAbbreviation(e.target.value)}
                placeholder="e.g. pcs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingUnit ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Unit</DialogTitle>
            <DialogDescription>
              {usedByProducts
                ? `This unit "${deletingUnit?.name}" is used by products. Deleting it will not remove the products but they will have no unit. Are you sure?`
                : `Are you sure you want to delete "${deletingUnit?.name}"? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
