import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const DEFAULT_ADMIN = {
    email: 'admin@olshop.com',
    password: 'admin123',
    full_name: 'Administrator',
    role: 'admin',
    status: 'approved'
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [permissions, setPermissions] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        checkUser()
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                fetchProfile(session.user.id)
            } else {
                setUser(null)
                setProfile(null)
                setLoading(false)
            }
        })
        return () => subscription.unsubscribe()
    }, [])

    async function checkUser() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                setUser(session.user)
                await fetchProfile(session.user.id)
            } else {
                setLoading(false)
            }
        } catch {
            setLoading(false)
        }
    }

    async function fetchProfile(userId) {
        try {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()
            if (profileError) throw profileError

            if (profileData?.role) {
                const { data: permData, error: permError } = await supabase
                    .from('role_permissions')
                    .select('menus')
                    .eq('role', profileData.role)
                    .single()
                if (!permError && permData?.menus) {
                    setPermissions(permData.menus)
                } else {
                    setPermissions([])
                }
            }

            setProfile(profileData)
            setUser(prev => prev ? { ...prev, profile: profileData } : null)
        } catch (err) {
            console.error('Error fetching profile:', err)
        } finally {
            setLoading(false)
        }
    }

    async function login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data.user) {
            setUser(data.user)
            await fetchProfile(data.user.id)
        }
        return data
    }

    async function register(email, password, fullName, role) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName, role, status: 'pending' } }
        })
        if (error) throw error
        // Profile is automatically created by database trigger (handle_new_user)
        return data
    }

    async function logout() {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setPermissions([])
    }

    async function approveUser(userId) {
        const { error } = await supabase
            .from('profiles')
            .update({ status: 'approved' })
            .eq('id', userId)
        if (error) throw error
    }

    async function rejectUser(userId) {
        const { error } = await supabase
            .from('profiles')
            .update({ status: 'rejected' })
            .eq('id', userId)
        if (error) throw error
    }

    async function updateUserRole(userId, newRole) {
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId)
        if (error) throw error
    }

    async function deleteUser(userId) {
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId)
        if (error) throw error
    }

    const value = {
        user,
        profile,
        permissions,
        loading,
        login,
        register,
        logout,
        approveUser,
        rejectUser,
        updateUserRole,
        deleteUser,
        isAdmin: profile?.role === 'admin',
        isOwner: profile?.role === 'owner',
        isAdminOrOwner: profile?.role === 'admin' || profile?.role === 'owner',
        hasAccess: (allowedRoles) => allowedRoles.includes(profile?.role),
        hasMenuAccess: (menuKey) => permissions.includes(menuKey)
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used within AuthProvider')
    return context
}
