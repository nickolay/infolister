<?xml version="1.0" encoding="UTF-8"?>

<!--
 XSLT: InfoLister output XML -> text
 Copyright (c) 2004-2005, Nickolay Ponomarev <asqueella at gmail dot com>
 
 Feel free to use and modify this file to better suit your needs.
 Please contact me if you think your improvements may be useful to others. 
-->

<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns="http://www.w3.org/1999/xhtml">

<xsl:output method="text" encoding="UTF-8" />

<xsl:template match="/info">My <xsl:value-of select="@app"/> information
<xsl:apply-templates /></xsl:template>

<xsl:template match="lastupd">Last updated: <xsl:value-of select="."/></xsl:template>

<xsl:template match="useragent">User Agent: <xsl:value-of select="."/></xsl:template>

<xsl:template match="extensions"> <!-- xxx onelist -->
***Extensions (enabled: <xsl:value-of select="count(ext[@disabled!=true()])"/>, disabled: <xsl:value-of select="count(ext[@disabled])"/>):
<xsl:for-each select="ext">
<xsl:apply-templates select="."/><xsl:text>  
</xsl:text>  
</xsl:for-each>
</xsl:template>

<xsl:template match="themes">
***Themes (<xsl:value-of select="count(theme)"/>):
<xsl:for-each select="theme">
<xsl:apply-templates select="."/><xsl:text>  
</xsl:text>
</xsl:for-each>
</xsl:template>

<xsl:template match="plugins">
***Plugins (<xsl:value-of select="count(plugin)"/>):
<xsl:for-each select="plugin">
<xsl:apply-templates select="."/>
</xsl:for-each>
</xsl:template>

<xsl:template match="ext|theme|plugin">
 <xsl:value-of select="text()"/>
<xsl:text> </xsl:text><xsl:value-of select="@version"/>
<xsl:if test="@creator"><xsl:text> by </xsl:text><xsl:value-of select="@creator"/></xsl:if>
<!-- <xsl:if test="@description">
- <xsl:value-of select="@description"/></xsl:if> -->
<xsl:if test="@disabled"><xsl:text> [disabled]</xsl:text></xsl:if>
<xsl:if test="@selected"><xsl:text> [selected]</xsl:text></xsl:if>
</xsl:template>

</xsl:stylesheet>
